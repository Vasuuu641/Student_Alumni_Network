import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import type { Socket } from 'socket.io-client'
import { NotesYProvider } from './notes-y-provider'

export const ydoc = new Y.Doc()
export const awareness = new awarenessProtocol.Awareness(ydoc)

type Post = (type: string, payload?: unknown) => void

export interface RoomInfo {
  status: 'connecting' | 'joined' | 'denied' | 'error'
  canEdit: boolean
  peerCount: number
  user: { name: string; color: string }
}

// Stands in for socket.io's Socket: NotesYProvider only uses on / off / emit.
// The real socket lives in React Native.
class BridgeSocket {
  private handlers = new Map<string, Set<(p: any) => void>>()
  constructor(private send: (ev: string, payload: unknown) => void) {}
  on(ev: string, fn: (p: any) => void) {
    if (!this.handlers.has(ev)) this.handlers.set(ev, new Set())
    this.handlers.get(ev)!.add(fn)
    return this
  }
  off(ev: string, fn: (p: any) => void) {
    this.handlers.get(ev)?.delete(fn)
    return this
  }
  emit(ev: string, payload: unknown) {
    this.send(ev, payload)
    return this
  }
  dispatch(ev: string, payload: unknown) {
    this.handlers.get(ev)?.forEach((fn) => fn(payload))
  }
}

// True if a Tiptap JSON doc (or legacy HTML string) holds real content.
function hasContent(n: any): boolean {
  if (!n) return false
  if (typeof n === 'string') return /<img/i.test(n) || n.replace(/<[^>]*>/g, '').trim().length > 0
  if (n.type === 'text') return !!n.text
  if (n.type === 'image' || n.type === 'horizontalRule') return true
  return (n.content ?? []).some(hasContent)
}

export function createCollab(editor: any, post: Post) {
  ;(window as any).__editor = editor // debug handle for chrome://inspect

  // Send WebView errors to the React Native console (Metro) instead of
  // painting them over the editor.
  window.addEventListener('error', (e) => post('error', e.message))
  window.addEventListener('unhandledrejection', (e: any) =>
    post('error', String(e?.reason?.stack ?? e?.reason)),
  )

  let room: RoomInfo = {
    status: 'connecting',
    canEdit: false,
    peerCount: 0,
    user: { name: 'Connecting…', color: '#999999' },
  }
  let initialContent: unknown = null
  let restHadContent = false
  let sock: BridgeSocket | null = null
  let provider: NotesYProvider | null = null
  let joined = false
  let seeded = false
  let armed = false
  let blocked = false
  let everHadContent = false
  // True only when THIS device changed the document (typing, local undo/redo).
  // Changes that arrive through Yjs from other users never set it, so mobile
  // can't overwrite the saved note with something it didn't author.
  let dirty = false
  let contentTimer: ReturnType<typeof setTimeout> | undefined
  let lastHistory = ''

  const docHasContent = () => hasContent(editor.getJSON())

  const sendContent = () => {
    clearTimeout(contentTimer)
    if (!armed || blocked || !dirty) return
    const json = editor.getJSON()
    const has = hasContent(json)
    if (has) everHadContent = true
    if (!has && !everHadContent && restHadContent) return
    dirty = false
    post('content', { json, cleared: !has && everHadContent })
  }

  editor.on('update', ({ transaction }: any) => {
    if (!armed || blocked) return
    // setEditable() also emits 'update' – ignore anything that didn't change the doc.
    if (!transaction?.docChanged) return
    // Remote Yjs change (other user / sync)? Not ours to persist.
    // Local undo/redo also arrives with isChangeOrigin, so let those through.
    const sync = transaction.getMeta?.('y-sync$')
    if (sync?.isChangeOrigin && !sync?.isUndoRedoOperation) return
    dirty = true
    clearTimeout(contentTimer)
    contentTimer = setTimeout(sendContent, 500)
  })

  editor.on('transaction', () => {
    // Never let this listener throw: an exception here escapes
    // dispatchTransaction and aborts setContent / selection updates.
    let canUndo = false
    let canRedo = false
    try {
      const can = editor.can() as any
      canUndo = typeof can.undo === 'function' ? !!can.undo() : false
      canRedo = typeof can.redo === 'function' ? !!can.redo() : false
    } catch {}
    const key = `${canUndo}${canRedo}`
    if (key !== lastHistory) {
      lastHistory = key
      post('history', { canUndo, canRedo })
    }
  })

  const waitFor = async (cond: () => boolean, ms: number) => {
    const end = Date.now() + ms
    while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 200))
  }

  const focusIfEditable = () => {
    if (!room.canEdit || blocked) return
    try {
      editor.setEditable(true)
      editor.commands.focus('end')
    } catch {}
  }

  const seedOnce = () => {
    if (seeded) return
    seeded = true
    setTimeout(async () => {
      if (!docHasContent() && room.peerCount === 0 && restHadContent) {
        editor.commands.setContent(initialContent as any)
      } else if (!docHasContent() && room.peerCount > 0) {
        await waitFor(docHasContent, 3000)
      }

      if (docHasContent()) {
        everHadContent = true
        armed = true
        post('armed', true)
        focusIfEditable()
      } else if (!restHadContent) {
        armed = true
        post('armed', true)
        focusIfEditable()
      } else {
        blocked = true
        try { editor.setEditable(false) } catch {}
        post('load-failed', true)
      }
    }, 500)
  }

  return {
    init(p: { noteId: string; initialContent: unknown }) {
      if (sock) { post('inited', true); return }
      initialContent = p.initialContent
      restHadContent = hasContent(initialContent)
      sock = new BridgeSocket((ev, payload) => {
        if (ev === 'notes:crdt-update' && !room.canEdit) return
        post('socket-emit', { ev, payload })
      })
      provider = new NotesYProvider(
        p.noteId,
        ydoc,
        sock as unknown as Socket,
        room.user,
        awareness,
      )
      // Lets the RN debug line confirm which bundle is running and whether the
      // collab extensions were actually loaded into the editor.
      const names: string[] = editor.extensionManager.extensions.map((e: any) => e.name)
      post('info', {
        build: (window as any).__BUILD__ ?? 'unknown',
        collabLoaded: names.includes('collaboration'),
        pageSectionLoaded: names.includes('pageSection'),
      })
      post('inited', true)
    },

    setRoom(next: RoomInfo) {
      const prev = room
      room = next
      try {
        editor.setEditable(next.canEdit && !blocked)
      } catch (e: any) {
        post('error', String(e?.stack || e))
      }
      if (prev.user.name !== next.user.name || prev.user.color !== next.user.color) {
        provider?.setUser(next.user)
      }
      const nowJoined = next.status === 'joined'
      if (nowJoined !== joined) {
        joined = nowJoined
        provider?.setJoined(nowJoined)
        if (nowJoined) {
          provider?.syncAfterJoin(next.canEdit)
          seedOnce()
        }
      }
    },

    socketEvent(ev: string, payload: unknown) {
      sock?.dispatch(ev, payload)
    },
    replace(json: unknown) {
      editor.commands.setContent(json as any)
      // The restore already happened on the server; don't echo it back as a save.
      clearTimeout(contentTimer)
      dirty = false
      if (hasContent(json)) everHadContent = true
    },
    flush() {
      sendContent()
    },
    destroy() {
      clearTimeout(contentTimer)
      provider?.destroy()
    },
  }
}
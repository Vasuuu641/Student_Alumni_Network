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
  ;(window as any).__editor = editor // TEMPORARY debug handle for chrome://inspect

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
  let contentTimer: ReturnType<typeof setTimeout> | undefined
  let lastHistory = ''

  const docHasContent = () => hasContent(editor.getJSON())

  const sendContent = () => {
    clearTimeout(contentTimer)
    if (!armed || blocked) return
    const json = editor.getJSON()
    const has = hasContent(json)
    if (has) everHadContent = true
    if (!has && !everHadContent && restHadContent) return
    post('content', { json, cleared: !has && everHadContent })
  }

  editor.on('update', () => {
    if (!armed || blocked) return
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
      } else if (!restHadContent) {
        armed = true
        post('armed', true)
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
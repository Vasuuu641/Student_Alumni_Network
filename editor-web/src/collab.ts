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
  blocked?: boolean
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
  off(ev: string, fn: (p: any) => void) { this.handlers.get(ev)?.delete(fn); return this }
  emit(ev: string, payload: unknown) { this.send(ev, payload); return this }
  dispatch(ev: string, payload: unknown) { this.handlers.get(ev)?.forEach((fn) => fn(payload)) }
}

export function createCollab(editor: any, post: Post) {
  ;(window as any).__editor = editor   
  let room: RoomInfo = {
    status: 'connecting', canEdit: false, peerCount: 0,
    user: { name: 'Connecting…', color: '#999999' },
  }
  let initialContent: unknown = null
  let sock: BridgeSocket | null = null
  let provider: NotesYProvider | null = null
  let joined = false
  let seeded = false
  let armed = false
  let contentTimer: ReturnType<typeof setTimeout> | undefined
  let lastHistory = ''

  const sendContent = () => { clearTimeout(contentTimer); post('content', editor.getJSON()) }

  // Fires for local AND remote (Yjs) changes, same as web's onUpdate.
  // Tiptap v2's setContent doesn't emit 'update' by default, so seeding/restoring never re-saves.
  editor.on('update', () => {
    if (!armed) return
    clearTimeout(contentTimer)
    contentTimer = setTimeout(sendContent, 500)
  })

  editor.on('transaction', () => {
    const canUndo = editor.can().undo()
    const canRedo = editor.can().redo()
    const key = `${canUndo}${canRedo}`
    if (key !== lastHistory) { lastHistory = key; post('history', { canUndo, canRedo }) }
  })

  // Same rule as web: seed from REST only if the doc is empty and nobody else is in the room.
  const seedOnce = () => {
    if (seeded) return
    seeded = true
    setTimeout(() => {
      const empty = editor.getText().trim().length === 0
      if (empty && room.peerCount === 0 && initialContent) {
        editor.commands.setContent(initialContent as any)   // JSON or legacy HTML string
      }
      armed = true
      post('armed', true)
    }, 500)
  }

  return {
    init(p: { noteId: string; initialContent: unknown }) {
      if (sock) return
      initialContent = p.initialContent
      sock = new BridgeSocket((ev, payload) => {
        if (ev === 'notes:crdt-update' && !room.canEdit) return   // viewers never write
        post('socket-emit', { ev, payload })
      })
      provider = new NotesYProvider(p.noteId, ydoc, sock as unknown as Socket, room.user, awareness)
    },

    setRoom(next: RoomInfo) {
      const prev = room
      room = next
      try {
        editor.setEditable(next.canEdit && !next.blocked)
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
        if (nowJoined) { provider?.syncAfterJoin(next.canEdit); seedOnce() }
      }
    },

    socketEvent(ev: string, payload: unknown) { sock?.dispatch(ev, payload) },
    replace(json: unknown) { editor.commands.setContent(json as any) },   // version restore (actor only)
    flush() { if (armed) sendContent() },
    destroy() { clearTimeout(contentTimer); provider?.destroy() },
  }
}
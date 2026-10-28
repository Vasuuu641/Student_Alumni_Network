import { useEffect } from 'react'
import { socket } from '../lib/socket'
import { collabListeners } from '../editor/CollabNativeBridge'

const RELAYED = [
  'notes:crdt-update',
  'notes:awareness',
  'notes:sync-request',
  'notes:sync-response',
  'notes:awareness-rebroadcast-request',
]

// Connects the single React Native socket to the Yjs provider living in the WebView.
export function useCollabRelay(editor: any, noteId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const subs = RELAYED.map((ev) => {
      const handler = (payload: any) => {
        if (payload?.noteId && payload.noteId !== noteId) return
        editor.collabSocket(ev, payload)
      }
      socket.on(ev, handler)
      return [ev, handler] as const
    })

    const fromWebView = (type: string, msg: any) => {
      if (type !== 'socket-emit') return
      if (!RELAYED.includes(msg?.ev) || msg.payload?.noteId !== noteId) return
      if (socket.connected) socket.emit(msg.ev, msg.payload) // never buffer stale CRDT traffic
    }
    collabListeners.add(fromWebView)

    return () => {
      subs.forEach(([ev, h]) => socket.off(ev, h))
      collabListeners.delete(fromWebView)
    }
  }, [editor, noteId, enabled])
}
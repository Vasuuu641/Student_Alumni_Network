// src/hooks/useNoteRoom.ts
import { useEffect, useState } from 'react'
import { socket } from '../lib/socket'

export type NoteRole = 'OWNER' | 'EDITOR' | 'VIEWER'

interface RoomState {
  status: 'connecting' | 'joined' | 'denied' | 'error'
  role: NoteRole | null
  canEdit: boolean
}

export function useNoteRoom(noteId: string) {
  const [state, setState] = useState<RoomState>({
    status: 'connecting',
    role: null,
    canEdit: false,
  })

  useEffect(() => {
    if (!noteId) return

    // Connect the socket if it isn't already connected
    if (!socket.connected) socket.connect()

    socket.emit('notes:join', { noteId })

    const onJoined = (data: {
      noteId: string
      role: NoteRole
      canEdit: boolean
    }) => {
      // Guard against events from other note rooms if the user
      // has multiple tabs open
      if (data.noteId !== noteId) return
      setState({ status: 'joined', role: data.role, canEdit: data.canEdit })
    }

    const onError = (data: { message: string }) => {
      if (
        data.message.includes('Access denied') ||
        data.message.includes('Unauthorized')
      ) {
        setState({ status: 'denied', role: null, canEdit: false })
      } else {
        setState({ status: 'error', role: null, canEdit: false })
      }
    }

    // If the socket drops and reconnects mid-session, re-join the room
    // automatically — the server clears room state on disconnect
    const onReconnect = () => {
      socket.emit('notes:join', { noteId })
    }

    socket.on('notes:joined', onJoined)
    socket.on('error', onError)
    socket.io.on('reconnect', onReconnect)

    return () => {
      socket.emit('notes:leave', { noteId })
      socket.off('notes:joined', onJoined)
      socket.off('error', onError)
      socket.io.off('reconnect', onReconnect)
    }
  }, [noteId])

  return state
}
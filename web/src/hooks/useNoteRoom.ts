// src/hooks/useNoteRoom.ts
import { useEffect, useState } from 'react'
import { socket } from '../lib/socket'

export type NoteRole = 'OWNER' | 'EDITOR' | 'VIEWER'

interface RoomState {
  status: 'connecting' | 'joined' | 'denied' | 'error'
  role: NoteRole | null
  canEdit: boolean
  currentUser: {
    userId: string
    displayName: string
    email: string | null
  } | null
}

export function useNoteRoom(noteId: string) {
  const [state, setState] = useState<RoomState>({
    status: 'connecting',
    role: null,
    canEdit: false,
    currentUser: null,
  })

  useEffect(() => {
    if (!noteId) return

    // Enter connecting state whenever note changes.
    setState({ status: 'connecting', role: null, canEdit: false, currentUser: null })

    const onJoined = (data: {
      noteId: string
      role: NoteRole
      canEdit: boolean
      userId?: string
      displayName?: string
      email?: string | null
    }) => {
      // Guard against events from other note rooms if the user
      // has multiple tabs open
      if (data.noteId !== noteId) return
      setState({
        status: 'joined',
        role: data.role,
        canEdit: data.canEdit,
        currentUser: {
          userId: data.userId ?? '',
          displayName: data.displayName ?? data.userId ?? '',
          email: data.email ?? null,
        },
      })
    }

    const onError = (data: { message: string }) => {
      if (
        data.message.includes('Access denied') ||
        data.message.includes('Unauthorized')
      ) {
        setState({ status: 'denied', role: null, canEdit: false, currentUser: null })
      } else {
        setState({ status: 'error', role: null, canEdit: false, currentUser: null })
      }
    }

    const onConnect = () => {
      // Join on first successful connect as well.
      socket.emit('notes:join', { noteId })
    }

    const onConnectError = (error: Error & { message?: string }) => {
      const message = error?.message ?? ''
      if (
        message.includes('Unauthorized') ||
        message.includes('invalid or missing token')
      ) {
        setState({ status: 'denied', role: null, canEdit: false, currentUser: null })
      } else {
        setState({ status: 'error', role: null, canEdit: false, currentUser: null })
      }
    }

    const onDisconnect = () => {
      // Keep user informed while reconnecting.
      setState((prev) => ({ ...prev, status: 'connecting', currentUser: null }))
    }

    // If the socket drops and reconnects mid-session, re-join the room
    // automatically — the server clears room state on disconnect
    const onReconnect = () => {
      socket.emit('notes:join', { noteId })
    }

    socket.on('connect', onConnect)
    socket.on('notes:joined', onJoined)
    socket.on('error', onError)
    socket.on('connect_error', onConnectError)
    socket.on('disconnect', onDisconnect)
    socket.io.on('reconnect', onReconnect)

    // Connect after listener registration to avoid missing a fast
    // notes:joined ack event.
    if (!socket.connected) {
      socket.connect()
    } else {
      socket.emit('notes:join', { noteId })
    }

    return () => {
      socket.emit('notes:leave', { noteId })
      socket.off('connect', onConnect)
      socket.off('notes:joined', onJoined)
      socket.off('error', onError)
      socket.off('connect_error', onConnectError)
      socket.off('disconnect', onDisconnect)
      socket.io.off('reconnect', onReconnect)
    }
  }, [noteId])

  return state
}
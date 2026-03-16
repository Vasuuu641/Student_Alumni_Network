// src/hooks/useNoteRoom.ts
import { useEffect, useState } from 'react'
import { socket } from '../lib/socket'
import type { PresenceUser } from './usePresence'

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
  // Fix 13 — captured here instead of usePresence so the snapshot
  // event is never missed due to component mount timing
  initialPresence: PresenceUser[]
}

export function useNoteRoom(noteId: string) {
  const [state, setState] = useState<RoomState>({
    status: 'connecting',
    role: null,
    canEdit: false,
    currentUser: null,
    initialPresence: [],
  })

  useEffect(() => {
    if (!noteId) return

    setState({
      status: 'connecting',
      role: null,
      canEdit: false,
      currentUser: null,
      initialPresence: [],
    })

    const onJoined = (data: {
      noteId: string
      role: NoteRole
      canEdit: boolean
      userId?: string
      displayName?: string
      email?: string | null
    }) => {
      if (data.noteId !== noteId) return
      setState((prev) => ({
        ...prev,
        status: 'joined',
        role: data.role,
        canEdit: data.canEdit,
        currentUser: {
          userId: data.userId ?? '',
          displayName: data.displayName ?? data.userId ?? '',
          email: data.email ?? null,
        },
      }))
    }

    // Fix 13 — snapshot listener lives here alongside notes:joined
    // so it's registered before the join fires and never missed.
    // usePresence previously registered this listener after the
    // component tree rendered, which was too late for editors joining
    // into an existing session.
    const onPresenceSnapshot = (data: {
      noteId: string
      users: PresenceUser[]
    }) => {
      if (data.noteId !== noteId) return
      setState((prev) => ({ ...prev, initialPresence: data.users }))
    }

    const onError = (data: { message: string }) => {
      if (
        data.message.includes('Access denied') ||
        data.message.includes('Unauthorized')
      ) {
        setState({ status: 'denied', role: null, canEdit: false, currentUser: null, initialPresence: [] })
      } else {
        setState({ status: 'error', role: null, canEdit: false, currentUser: null, initialPresence: [] })
      }
    }

    const onConnect = () => {
      socket.emit('notes:join', { noteId })
    }

    const onConnectError = (error: Error & { message?: string }) => {
      const message = error?.message ?? ''
      if (
        message.includes('Unauthorized') ||
        message.includes('invalid or missing token')
      ) {
        setState({ status: 'denied', role: null, canEdit: false, currentUser: null, initialPresence: [] })
      } else {
        setState({ status: 'error', role: null, canEdit: false, currentUser: null, initialPresence: [] })
      }
    }

    const onDisconnect = () => {
      setState((prev) => ({
        ...prev,
        status: 'connecting',
        currentUser: null,
        initialPresence: [],
      }))
    }

    const onReconnect = () => {
      socket.emit('notes:join', { noteId })
    }

    socket.on('connect', onConnect)
    socket.on('notes:joined', onJoined)
    socket.on('notes:presence-snapshot', onPresenceSnapshot)
    socket.on('error', onError)
    socket.on('connect_error', onConnectError)
    socket.on('disconnect', onDisconnect)
    socket.io.on('reconnect', onReconnect)

    if (!socket.connected) {
      socket.connect()
    } else {
      socket.emit('notes:join', { noteId })
    }

    return () => {
      socket.emit('notes:leave', { noteId })
      socket.off('connect', onConnect)
      socket.off('notes:joined', onJoined)
      socket.off('notes:presence-snapshot', onPresenceSnapshot)
      socket.off('error', onError)
      socket.off('connect_error', onConnectError)
      socket.off('disconnect', onDisconnect)
      socket.io.off('reconnect', onReconnect)
    }
  }, [noteId])

  return state
}
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
  initialPresence: PresenceUser[]
}

export function useNoteRoom(noteId: string, enabled = true) {
  const [state, setState] = useState<RoomState>({
    status: 'connecting',
    role: null,
    canEdit: false,
    currentUser: null,
    initialPresence: [],
  })

  useEffect(() => {
    if (!noteId || !enabled) return

    setState({
      status: 'connecting',
      role: null,
      canEdit: false,
      currentUser: null,
      initialPresence: [],
    })

    // Tracks whether this effect instance is still active.
    // Prevents stale closures from updating state after cleanup
    // runs, which was causing rapid join/leave cycling when React
    // re-ran the effect due to strict mode or noteId changes.
    let active = true

    const onJoined = (data: {
      noteId: string
      role: NoteRole
      canEdit: boolean
      userId?: string
      displayName?: string
      email?: string | null
    }) => {
      if (!active) return
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

    const onPresenceSnapshot = (data: {
      noteId: string
      users: PresenceUser[]
    }) => {
      if (!active) return
      if (data.noteId !== noteId) return
      setState((prev) => ({ ...prev, initialPresence: data.users }))
    }

    const onError = (data: { message: string }) => {
      if (!active) return
      if (
        data.message.includes('Access denied') ||
        data.message.includes('Unauthorized')
      ) {
        setState({ status: 'denied', role: null, canEdit: false, currentUser: null, initialPresence: [] })
      } else {
        setState({ status: 'error', role: null, canEdit: false, currentUser: null, initialPresence: [] })
      }
    }

    const onConnectError = (error: Error & { message?: string }) => {
      if (!active) return
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
      if (!active) return
      setState((prev) => ({
        ...prev,
        status: 'connecting',
        currentUser: null,
        initialPresence: [],
      }))
    }

    const onReconnect = () => {
      if (!active) return
      socket.emit('notes:join', { noteId })
    }

    // Register all listeners before connecting or joining
    // so no events are missed
    socket.on('notes:joined', onJoined)
    socket.on('notes:presence-snapshot', onPresenceSnapshot)
    socket.on('error', onError)
    socket.on('connect_error', onConnectError)
    socket.on('disconnect', onDisconnect)
    socket.io.on('reconnect', onReconnect)

    // Replaced persistent socket.on('connect') with socket.once —
    // the persistent listener was firing on every reconnect AND
    // combining with the already-connected branch below to emit
    // notes:join twice, causing the rapid join/leave cycle in the logs
    if (socket.connected) {
      socket.emit('notes:join', { noteId })
    } else {
      socket.once('connect', () => {
        if (active) socket.emit('notes:join', { noteId })
      })
      socket.connect()
    }

    return () => {
      active = false
      socket.emit('notes:leave', { noteId })
      socket.off('notes:joined', onJoined)
      socket.off('notes:presence-snapshot', onPresenceSnapshot)
      socket.off('error', onError)
      socket.off('connect_error', onConnectError)
      socket.off('disconnect', onDisconnect)
      socket.io.off('reconnect', onReconnect)
      // Remove the once listener in case it hasn't fired yet,
      // preventing a ghost join after the component unmounts
      socket.off('connect')
    }
  }, [enabled, noteId])

  return state
}
import { useEffect, useState } from 'react'
import { socket } from '../lib/socket'

export type NoteRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export interface PresenceUser {
  userId: string
  role?: string
  email?: string | null
  displayName?: string
}

interface RoomState {
  status: 'connecting' | 'joined' | 'denied' | 'error'
  role: NoteRole | null
  canEdit: boolean
  currentUser: { userId: string; displayName: string; email: string | null } | null
  others: PresenceUser[]   // display only: excludes me
  peerCount: number        // seed decision: includes my other devices
}

const INITIAL: RoomState = {
  status: 'connecting',
  role: null,
  canEdit: false,
  currentUser: null,
  others: [],
  peerCount: 0,
}

export function useNoteRoom(noteId: string, enabled = true) {
  const [state, setState] = useState<RoomState>(INITIAL)

  useEffect(() => {
    if (!noteId || !enabled) return
    setState(INITIAL)
    let active = true
    let retried = false

    const join = () => {
      if (active) socket.emit('notes:join', { noteId })
    }

    const onJoined = (d: any) => {
      if (!active || d.noteId !== noteId) return
      retried = false
      setState((p) => ({
        ...p,
        status: 'joined',
        role: d.role,
        canEdit: d.canEdit,
        currentUser: {
          userId: d.userId ?? '',
          displayName: d.displayName ?? d.userId ?? '',
          email: d.email ?? null,
        },
      }))
    }

    const onSnapshot = (d: { noteId: string; users: PresenceUser[] }) => {
      if (!active || d.noteId !== noteId) return
      setState((p) => ({
        ...p,
        others: d.users.filter((u) => u.userId !== p.currentUser?.userId),
        peerCount: d.users.length,
      }))
    }

    const onPresence = (d: any) => {
      if (!active) return
      setState((p) => {
        const peerCount = Math.max(0, p.peerCount + (d.event === 'user-joined' ? 1 : -1))
        if (d.userId === p.currentUser?.userId) return { ...p, peerCount }
        if (d.event === 'user-joined') {
          if (p.others.some((u) => u.userId === d.userId)) return { ...p, peerCount }
          return {
            ...p,
            peerCount,
            others: [
              ...p.others,
              { userId: d.userId, role: d.role, email: d.email, displayName: d.displayName },
            ],
          }
        }
        return { ...p, peerCount, others: p.others.filter((u) => u.userId !== d.userId) }
      })
    }

    const onError = (d: { message?: string }) => {
      if (!active) return
      const m = d?.message ?? ''
      if (m.includes('Join the note room first')) return join()
      if (m.includes('Unauthorized') && !retried) {
        retried = true
        setTimeout(join, 400)
        return
      }
      if (m.includes('Access denied') || m.includes('Unauthorized')) {
        setState({ ...INITIAL, status: 'denied' })
      }
    }

    const onConnectError = (e: Error) => {
      if (!active) return
      const denied = /Unauthorized|invalid or missing token/.test(e?.message ?? '')
      setState({ ...INITIAL, status: denied ? 'denied' : 'error' })
    }

    const onDisconnect = () => {
      if (active) setState((p) => ({ ...p, status: 'connecting', others: [], peerCount: 0 }))
    }

    socket.on('notes:joined', onJoined)
    socket.on('notes:presence-snapshot', onSnapshot)
    socket.on('notes:presence', onPresence)
    socket.on('error', onError)
    socket.on('connect_error', onConnectError)
    socket.on('disconnect', onDisconnect)
    socket.on('connect', join)

    if (socket.connected) join()
    else socket.connect()

    return () => {
      active = false
      if (socket.connected) socket.emit('notes:leave', { noteId })
      socket.off('notes:joined', onJoined)
      socket.off('notes:presence-snapshot', onSnapshot)
      socket.off('notes:presence', onPresence)
      socket.off('error', onError)
      socket.off('connect_error', onConnectError)
      socket.off('disconnect', onDisconnect)
      socket.off('connect', join)
    }
  }, [noteId, enabled])

  return state
}
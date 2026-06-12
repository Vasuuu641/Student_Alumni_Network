// hooks/useNotePresence.ts
// Tracks live presence for a note via the NotesGateway socket protocol.
//
// Gateway contract (see notes.gateway.ts):
//   Emit:   notes:join  { noteId }                — server derives userId from session
//   Emit:   notes:leave { noteId }
//   Listen: notes:joined           { noteId, role, canEdit, userId, email, displayName }
//   Listen: notes:presence-snapshot { noteId, users: [{ userId, role, email, displayName }] }
//   Listen: notes:presence          { event: 'user-joined'|'user-left', userId, ... }

import { useEffect, useState } from 'react'
import { socket } from '../lib/socket'

interface PresenceUser {
  userId: string
  role?: string
  email?: string | null
  displayName?: string
}

interface PresenceSnapshot {
  noteId: string
  users: PresenceUser[]
}

interface PresenceDelta {
  noteId?: string
  event: 'user-joined' | 'user-left'
  userId: string
  role?: string
  email?: string | null
  displayName?: string
}

interface UseNotePresenceOptions {
  noteId: string
  userId: string | null   // current user's id — used to exclude self from "others"
  enabled?: boolean        // set false when note isn't loaded yet
}

interface UseNotePresenceResult {
  onlineCount: number     // total users online (including self)
  othersOnline: number    // onlineCount minus self
  userIds: string[]       // all online user ids (excluding self)
}

export function useNotePresence({
  noteId,
  userId,
  enabled = true,
}: UseNotePresenceOptions): UseNotePresenceResult {
  // otherUsers tracks everyone else in the room — self is implicit
  const [otherUsers, setOtherUsers] = useState<Map<string, PresenceUser>>(new Map())

  useEffect(() => {
    if (!enabled || !noteId || !userId) return

    // Socket has autoConnect: false — must connect explicitly
    if (!socket.connected) {
      socket.connect()
    }

    socket.emit('notes:join', { noteId })

    const handleSnapshot = (data: PresenceSnapshot) => {
      if (data.noteId !== noteId) return
      const map = new Map<string, PresenceUser>()
      for (const u of data.users) {
        if (u.userId !== userId) map.set(u.userId, u)
      }
      setOtherUsers(map)
    }

    const handlePresenceDelta = (data: PresenceDelta) => {
      // notes:presence doesn't always include noteId (server emits to the room),
      // so we just trust we're only subscribed while in this note's room
      if (data.userId === userId) return

      setOtherUsers((prev) => {
        const next = new Map(prev)
        if (data.event === 'user-joined') {
          next.set(data.userId, {
            userId: data.userId,
            role: data.role,
            email: data.email,
            displayName: data.displayName,
          })
        } else if (data.event === 'user-left') {
          next.delete(data.userId)
        }
        return next
      })
    }

    socket.on('notes:presence-snapshot', handleSnapshot)
    socket.on('notes:presence', handlePresenceDelta)

    return () => {
      socket.emit('notes:leave', { noteId })
      socket.off('notes:presence-snapshot', handleSnapshot)
      socket.off('notes:presence', handlePresenceDelta)
      setOtherUsers(new Map())
    }
  }, [noteId, userId, enabled])

  const userIds = Array.from(otherUsers.keys())
  const othersOnline = userIds.length
  const onlineCount = othersOnline + 1 // +1 for self

  return { onlineCount, othersOnline, userIds }
}
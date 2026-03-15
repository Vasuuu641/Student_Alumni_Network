// src/hooks/usePresence.ts
import { useEffect, useState } from 'react'
import { socket } from '../lib/socket'

export type NoteRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export interface PresenceUser {
  userId: string
  role: NoteRole
}

export function usePresence(noteId: string) {
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!noteId) return

    const onPresence = (data: {
      event: 'user-joined' | 'user-left'
      userId: string
      role?: NoteRole
    }) => {
      if (data.event === 'user-joined') {
        setPresentUsers((prev) => {
          // Avoid duplicates if the same user joins twice
          // (e.g. multiple tabs)
          const already = prev.some((u) => u.userId === data.userId)
          if (already) return prev
          return [...prev, { userId: data.userId, role: data.role! }]
        })
      }

      if (data.event === 'user-left') {
        setPresentUsers((prev) =>
          prev.filter((u) => u.userId !== data.userId),
        )
      }
    }

    socket.on('notes:presence', onPresence)

    return () => {
      socket.off('notes:presence', onPresence)
      // Clear list when leaving the note
      setPresentUsers([])
    }
  }, [noteId])

  return { presentUsers }
}
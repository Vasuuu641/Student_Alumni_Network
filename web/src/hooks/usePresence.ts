// src/hooks/usePresence.ts
import { useEffect, useState } from 'react'
import { socket } from '../lib/socket'

export type NoteRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export interface PresenceUser {
  userId: string
  role: NoteRole
  displayName?: string
  email?: string | null
}

export function usePresence(noteId: string) {
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!noteId) return

    const onPresenceSnapshot = (data: {
      noteId: string
      users: PresenceUser[]
    }) => {
      if (data.noteId !== noteId) return
      setPresentUsers(data.users)
    }

    const onPresence = (data: {
      event: 'user-joined' | 'user-left'
      userId: string
      role?: NoteRole
      displayName?: string
      email?: string | null
    }) => {
      if (data.event === 'user-joined') {
        setPresentUsers((prev) => {
          // Avoid duplicates if the same user joins twice
          // (e.g. multiple tabs)
          const existingIndex = prev.findIndex((u) => u.userId === data.userId)
          if (existingIndex !== -1) {
            return prev.map((user) =>
              user.userId === data.userId
                ? {
                    ...user,
                    role: data.role ?? user.role,
                    displayName: data.displayName ?? user.displayName,
                    email: data.email ?? user.email,
                  }
                : user,
            )
          }

          return [
            ...prev,
            {
              userId: data.userId,
              role: data.role!,
              displayName: data.displayName,
              email: data.email,
            },
          ]
        })
      }

      if (data.event === 'user-left') {
        setPresentUsers((prev) =>
          prev.filter((u) => u.userId !== data.userId),
        )
      }
    }

    socket.on('notes:presence', onPresence)
    socket.on('notes:presence-snapshot', onPresenceSnapshot)

    return () => {
      socket.off('notes:presence', onPresence)
      socket.off('notes:presence-snapshot', onPresenceSnapshot)
      // Clear list when leaving the note
      setPresentUsers([])
    }
  }, [noteId])

  return { presentUsers }
}
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

// Fix 14 — accepts initialUsers from useNoteRoom which captures
// the presence-snapshot event before the component tree renders.
// The snapshot listener is removed from here entirely to avoid
// the race condition where it was registered too late.
export function usePresence(noteId: string, initialUsers: PresenceUser[] = []) {
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>(initialUsers)

  // Fix 14 — sync state when initialUsers arrives after room join resolves.
  // On first render initialUsers is [] so this is a no-op. Once useNoteRoom
  // resolves the snapshot it passes the populated array and this effect
  // updates the list without needing a socket event.
  useEffect(() => {
    if (initialUsers.length > 0) {
      setPresentUsers(initialUsers)
    }
  }, [initialUsers])

  useEffect(() => {
    if (!noteId) return

    const onPresence = (data: {
      event: 'user-joined' | 'user-left'
      userId: string
      role?: NoteRole
      displayName?: string
      email?: string | null
    }) => {
      if (data.event === 'user-joined') {
        setPresentUsers((prev) => {
          // Update existing entry if the same user rejoins
          // (e.g. multiple tabs or reconnect)
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

    // Fix 14 — notes:presence-snapshot removed from here.
    // It is now handled entirely by useNoteRoom which registers
    // the listener before the join fires, eliminating the race condition.
    socket.on('notes:presence', onPresence)

    return () => {
      socket.off('notes:presence', onPresence)
      setPresentUsers([])
    }
  }, [noteId])

  return { presentUsers }
}
import { useEffect, useState } from 'react'
import { socket } from '../lib/socket'

interface PresenceUpdate {
  noteId: string
  onlineCount: number
  userIds: string[]
}

interface UseNotePresenceOptions {
  noteId: string
  userId: string | null   // current user's id — null until auth resolves
  enabled?: boolean       // set false when note isn't loaded yet
}

interface UseNotePresenceResult {
  onlineCount: number     // total users online (including self)
  othersOnline: number    // onlineCount minus self — useful for display
  userIds: string[]       // all online user ids
}

export function useNotePresence({
  noteId,
  userId,
  enabled = true,
}: UseNotePresenceOptions): UseNotePresenceResult {
  const [onlineCount, setOnlineCount] = useState(0)
  const [userIds, setUserIds] = useState<string[]>([])

  useEffect(() => {
    if (!enabled || !noteId || !userId) return

    // Announce arrival
    socket.emit('notes:join', { noteId, userId })

    const handler = (event: PresenceUpdate) => {
      if (event.noteId !== noteId) return
      setOnlineCount(event.onlineCount)
      setUserIds(event.userIds)
    }

    socket.on('notes:presence-update', handler)

    return () => {
      // Announce departure
      socket.emit('notes:leave', { noteId, userId })
      socket.off('notes:presence-update', handler)
    }
  }, [noteId, userId, enabled])

  const othersOnline = Math.max(0, onlineCount - 1)

  return { onlineCount, othersOnline, userIds }
}
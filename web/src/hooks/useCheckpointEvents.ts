// src/hooks/useCheckpointEvents.ts
import { useEffect } from 'react'
import { socket } from '../lib/socket'

interface CheckpointEvent {
  noteId: string
  actorId: string
  versionNumber: number
  createdAt: string
}

export function useCheckpointEvents(
  noteId: string,
  onCheckpoint: (event: CheckpointEvent) => void,
) {
  useEffect(() => {
    if (!noteId) return

    const handler = (event: CheckpointEvent) => {
      // Guard against events from other notes if somehow
      // multiple rooms are active
      if (event.noteId !== noteId) return
      onCheckpoint(event)
    }

    socket.on('notes:checkpoint-created', handler)

    return () => {
      socket.off('notes:checkpoint-created', handler)
    }
  }, [noteId, onCheckpoint])
}
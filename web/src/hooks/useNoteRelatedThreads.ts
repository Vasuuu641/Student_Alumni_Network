import { useEffect, useState, useRef } from 'react'
import { socket } from '../lib/socket'
import type { RelatedThread } from '../api/notes.api'

interface UseNoteRelatedThreadsProps {
  noteId: string
  title: string
  contentJson: unknown
  enabled: boolean
}

export function useNoteRelatedThreads({
  noteId,
  title,
  contentJson,
  enabled,
}: UseNoteRelatedThreadsProps) {
  const [relatedThreads, setRelatedThreads] = useState<RelatedThread[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) {
      setRelatedThreads([])
      setIsLoading(false)
      return
    }

    // Debounce the search - wait 350ms after content stops changing before searching
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Calculate content length for minimum threshold check
    const contentText = title + ' ' + JSON.stringify(contentJson ?? '')
    if (contentText.trim().length < 20) {
      setRelatedThreads([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    debounceTimerRef.current = setTimeout(() => {
      if (!socket.connected) {
        setIsLoading(false)
        return
      }

      socket.emit('notes:typing-related-threads', {
        noteId,
        title,
        contentJson,
      })
    }, 350)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [noteId, title, contentJson, enabled])

  // Listen for related threads results
  useEffect(() => {
    const handleRelatedThreads = (data: {
      noteId: string
      results: RelatedThread[]
    }) => {
      if (data.noteId !== noteId) return
      setRelatedThreads(data.results)
      setIsLoading(false)
    }

    socket.on('notes:related-threads', handleRelatedThreads)
    return () => {
      socket.off('notes:related-threads', handleRelatedThreads)
    }
  }, [noteId])

  return {
    threads: relatedThreads,
    isLoading,
  }
}

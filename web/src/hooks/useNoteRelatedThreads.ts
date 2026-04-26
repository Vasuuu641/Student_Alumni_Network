import { useCallback, useEffect, useState } from 'react'
import { socket } from '../lib/socket'
import type { RelatedThread } from '../api/notes.api'

const MIN_CONTENT_CHARS = 20
const REQUEST_COOLDOWN_MS = 5000

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
  const [hasRequested, setHasRequested] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const cooldownRemainingMs = Math.max(0, cooldownUntil - now)

  useEffect(() => {
    if (!enabled) {
      setRelatedThreads([])
      setIsLoading(false)
      setHasRequested(false)
      setCooldownUntil(0)
    }
  }, [enabled])

  useEffect(() => {
    if (cooldownRemainingMs <= 0) return

    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 250)

    return () => {
      window.clearInterval(timer)
    }
  }, [cooldownRemainingMs])

  const requestRelatedThreads = useCallback(() => {
    if (!enabled) return
    if (cooldownRemainingMs > 0) return

    const contentText = title + ' ' + JSON.stringify(contentJson ?? '')
    setHasRequested(true)

    if (contentText.trim().length < MIN_CONTENT_CHARS) {
      setRelatedThreads([])
      setIsLoading(false)
      return
    }

    if (!socket.connected) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    socket.emit('notes:request-related-threads', {
      noteId,
      title,
      contentJson,
    })
    setCooldownUntil(Date.now() + REQUEST_COOLDOWN_MS)
    setNow(Date.now())
  }, [enabled, cooldownRemainingMs, noteId, title, contentJson])

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
    hasRequested,
    minContentChars: MIN_CONTENT_CHARS,
    cooldownRemainingMs,
    requestRelatedThreads,
  }
}

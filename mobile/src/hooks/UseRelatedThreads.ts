import { useCallback, useEffect, useRef, useState } from 'react'
import { socket } from '../lib/socket'
import type { RelatedThread } from '../api/notes.api'

const COOLDOWN_MS = 5_000         // match web: 5s cooldown
const MIN_CONTENT_LENGTH = 20     // match web: 20 char minimum

interface UseRelatedThreadsOptions {
  noteId: string
  token: string | null
  noteContent: string             // plain-text content for length check
  title: string
  contentJson: unknown            // raw editor JSON — sent to socket
  enabled: boolean
}

interface UseRelatedThreadsResult {
  threads: RelatedThread[]
  isLoading: boolean
  hasRequested: boolean
  canRequestSuggestions: boolean
  cooldownRemainingMs: number
  requestSuggestions: () => void
  reset: () => void
}

export function useRelatedThreads({
  noteId,
  noteContent,
  title,
  contentJson,
  enabled,
}: UseRelatedThreadsOptions): UseRelatedThreadsResult {
  const [threads, setThreads] = useState<RelatedThread[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasRequested, setHasRequested] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cooldownRemainingMs = Math.max(0, cooldownUntil - now)

  // ─── Reset when disabled (panel closed) ───────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      setThreads([])
      setIsLoading(false)
      setHasRequested(false)
      setCooldownUntil(0)
    }
  }, [enabled])

  // ─── Cooldown ticker — setInterval works in React Native ─────────────────
  useEffect(() => {
    if (cooldownRemainingMs <= 0) return

    tickRef.current = setInterval(() => {
      setNow(Date.now())
    }, 250)

    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [cooldownRemainingMs])

  // ─── Listen for socket response ───────────────────────────────────────────
  useEffect(() => {
    const handler = (data: { noteId: string; results: RelatedThread[] }) => {
      if (data.noteId !== noteId) return
      setThreads(data.results)
      setIsLoading(false)
    }

    socket.on('notes:related-threads', handler)
    return () => {
      socket.off('notes:related-threads', handler)
    }
  }, [noteId])

  const canRequestSuggestions =
    socket.connected &&
    noteContent.trim().length >= MIN_CONTENT_LENGTH &&
    cooldownRemainingMs <= 0

  // ─── Emit request via socket — same event as web ──────────────────────────
  const requestSuggestions = useCallback(() => {
    if (!enabled || !canRequestSuggestions || isLoading) return

    setIsLoading(true)
    setHasRequested(true)
    setCooldownUntil(Date.now() + COOLDOWN_MS)
    setNow(Date.now())

    socket.emit('notes:request-related-threads', {
      noteId,
      title,
      contentJson,
    })
  }, [enabled, canRequestSuggestions, isLoading, noteId, title, contentJson])

  // ─── Reset ────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setThreads([])
    setHasRequested(false)
    setCooldownUntil(0)
    setNow(Date.now())
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  return {
    threads,
    isLoading,
    hasRequested,
    canRequestSuggestions,
    cooldownRemainingMs,
    requestSuggestions,
    reset,
  }
}
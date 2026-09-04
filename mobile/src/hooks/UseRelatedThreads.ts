// hooks/useRelatedThreads.ts
// Manages AI-powered related thread suggestions for a note.
// Mirrors the web's useNoteRelatedThreads hook — socket-based, not REST.

import { useCallback, useEffect, useState } from 'react'
import { socket } from '../lib/socket'
import type { RelatedThread } from '../api/notes.api'

const MIN_CONTENT_CHARS = 20
const REQUEST_COOLDOWN_MS = 5000

interface UseRelatedThreadsOptions {
  noteId: string
  token: string | null   // accepted for API-compat, unused — socket auth handles this
  noteContent: string     // accepted for compat — contentJson is used instead
  title?: string
  contentJson?: unknown
  enabled?: boolean
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
  title = '',
  contentJson = null,
  enabled = true,
}: UseRelatedThreadsOptions): UseRelatedThreadsResult {
  const [threads, setThreads] = useState<RelatedThread[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasRequested, setHasRequested] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const cooldownRemainingMs = Math.max(0, cooldownUntil - now)

  useEffect(() => {
    if (!enabled) {
      setThreads([])
      setIsLoading(false)
      setHasRequested(false)
      setCooldownUntil(0)
    }
  }, [enabled])

  useEffect(() => {
    if (cooldownRemainingMs <= 0) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [cooldownRemainingMs])

  const contentText = title + ' ' + JSON.stringify(contentJson ?? '')
  const canRequestSuggestions = contentText.trim().length >= MIN_CONTENT_CHARS

  const requestSuggestions = useCallback(() => {
    if (!enabled) return
    if (cooldownRemainingMs > 0) return

    setHasRequested(true)

    if (contentText.trim().length < MIN_CONTENT_CHARS) {
      setThreads([])
      setIsLoading(false)
      return
    }

    if (!socket.connected) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    socket.emit('notes:request-related-threads', { noteId, title, contentJson })
    setCooldownUntil(Date.now() + REQUEST_COOLDOWN_MS)
    setNow(Date.now())
  }, [enabled, cooldownRemainingMs, noteId, title, contentJson, contentText])

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

  useEffect(() => {
  const errHandler = (e: { message: string }) => console.log('Socket error:', e.message)
  socket.on('error', errHandler)
  return () => { socket.off('error', errHandler) }
}, [])

  const reset = useCallback(() => {
    setThreads([])
    setHasRequested(false)
    setCooldownUntil(0)
    setIsLoading(false)
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
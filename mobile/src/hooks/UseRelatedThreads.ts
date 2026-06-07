// hooks/useRelatedThreads.ts
// Manages AI-powered related thread suggestions for a note.
// Mirrors the web's useRelatedThreads hook — no DOM APIs used.

import { useCallback, useEffect, useRef, useState } from 'react'
import { getRelatedThreads, type RelatedThread } from '../api/notes.api'

const COOLDOWN_MS = 30_000      // 30 s between requests — match your web config
const MIN_CONTENT_LENGTH = 50   // minimum chars before suggestions are allowed

interface UseRelatedThreadsOptions {
  noteId: string
  token: string | null
  noteContent: string    // plain-text content used for length check + sent to API
  title?: string         // optional — not used by this hook but accepted for compat
  contentJson?: any      // optional — not used by this hook but accepted for compat
  enabled?: boolean      // optional — if false, requestSuggestions is a no-op
}

interface UseRelatedThreadsResult {
  threads: RelatedThread[]
  isLoading: boolean
  hasRequested: boolean
  canRequestSuggestions: boolean
  cooldownRemainingMs: number
  requestSuggestions: () => Promise<void>
  reset: () => void
}

export function useRelatedThreads({
  noteId,
  token,
  noteContent,
  enabled = true,
}: UseRelatedThreadsOptions): UseRelatedThreadsResult {
  const [threads, setThreads] = useState<RelatedThread[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasRequested, setHasRequested] = useState(false)
  const [lastRequestAt, setLastRequestAt] = useState<number | null>(null)
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0)

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Cooldown ticker ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (lastRequestAt === null) return

    // Start ticking every 500ms to update the remaining cooldown
    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - lastRequestAt
      const remaining = Math.max(0, COOLDOWN_MS - elapsed)
      setCooldownRemainingMs(remaining)
      if (remaining === 0 && tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
    }, 500)

    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [lastRequestAt])

  const canRequestSuggestions = noteContent.trim().length >= MIN_CONTENT_LENGTH

  // ─── Request ──────────────────────────────────────────────────────────────────
  const requestSuggestions = useCallback(async () => {
    if (!enabled) return
    if (!token || !noteId || isLoading) return
    if (!canRequestSuggestions) return
    if (cooldownRemainingMs > 0) return

    setIsLoading(true)
    setHasRequested(true)
    setLastRequestAt(Date.now())
    setCooldownRemainingMs(COOLDOWN_MS)

    try {
      const { threads: fetched } = await getRelatedThreads(token, noteId)
      setThreads(fetched)
    } catch {
      setThreads([])
    } finally {
      setIsLoading(false)
    }
  }, [token, noteId, isLoading, canRequestSuggestions, cooldownRemainingMs])

  const reset = useCallback(() => {
    setThreads([])
    setHasRequested(false)
    setLastRequestAt(null)
    setCooldownRemainingMs(0)
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
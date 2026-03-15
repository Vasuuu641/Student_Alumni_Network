// src/pages/NotePage.tsx
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getNote, createCheckpoint } from '../api/notes.api'
import { CollaborativeEditor } from '../components/notes/CollaborativeEditor'
import { PresenceAvatars } from '../components/notes/PresenceAvatar'
import { VersionHistoryPanel } from '../components/notes/VersionHistoryPanel'
import { ConnectionStatus } from '../components/notes/ConnectionStatus'
import { useNoteRoom } from '../hooks/useNoteRoom'
import { stringToColor } from '../lib/utils'

// Replace this with however you access the current user in your app
// e.g. a useAuth hook, context, or zustand store
import { getAccessToken } from '../lib/auth'

interface Note {
  id: string
  title: string
  content: any
  ownerId: string
}

export function NotePage() {
  const { noteId } = useParams<{ noteId: string }>()
  const navigate = useNavigate()
  const token = getAccessToken()
  const currentUserId = token
  ? (JSON.parse(atob(token.split('.')[1])).userId as string)
  : null
  const currentUserName = currentUserId ?? 'Unknown'

  const [note, setNote] = useState<Note | null>(null)
  const [loadingNote, setLoadingNote] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [savingCheckpoint, setSavingCheckpoint] = useState(false)

  const room = useNoteRoom(noteId!)

  // ─── Initial note fetch ──────────────────────────────────────────────────

  const fetchNote = useCallback(async () => {
    if (!noteId) return
    try {
      setFetchError(null)
      const { note } = await getNote(noteId)
      setNote(note)
    } catch {
      setFetchError('Failed to load note')
    } finally {
      setLoadingNote(false)
    }
  }, [noteId])

  useEffect(() => {
    fetchNote()
  }, [fetchNote])

  // ─── Checkpoint ──────────────────────────────────────────────────────────

  const handleSaveCheckpoint = async () => {
    if (!noteId) return
    try {
      setSavingCheckpoint(true)
      await createCheckpoint(noteId)
    } catch {
      // Silently fail — the version panel will show the error
    } finally {
      setSavingCheckpoint(false)
    }
  }

  // ─── Restore ─────────────────────────────────────────────────────────────

  // After a restore the Y.js doc in memory is stale —
  // re-fetch the note to get the restored content
  const handleRestored = useCallback(() => {
    fetchNote()
    setShowVersionHistory(false)
  }, [fetchNote])

  // ─── Derived state ────────────────────────────────────────────────────────

  const canRestore = room.role === 'OWNER'
  const canSaveCheckpoint = room.canEdit

  // Assign a deterministic color to the current user
  // based on their userId so it stays consistent
  const userColor = stringToColor(currentUserId ?? '')

  // ─── Loading / error states ───────────────────────────────────────────────

  if (loadingNote) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        Loading note...
      </div>
    )
  }

  if (fetchError || !note) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <p className="text-red-500">{fetchError ?? 'Note not found'}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-blue-600 hover:underline"
        >
          Go back
        </button>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Connection banner — only visible when offline/reconnecting */}
      <ConnectionStatus />

      {/* ─── Header ───────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-3
                         border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ←
          </button>
          <h1 className="text-base font-medium text-gray-900 truncate max-w-xs">
            {note.title}
          </h1>
          {room.role && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100
                             text-gray-500 capitalize">
              {room.role.toLowerCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Live presence avatars */}
          {room.status === 'joined' && (
            <PresenceAvatars
              noteId={noteId!}
              currentUser={{
                userId: currentUserId ?? 'Unknown',
                name: currentUserName,
                color: userColor,
                role: room.role!,
              }}
            />
          )}

          {/* Save checkpoint button — editors and owners only */}
          {canSaveCheckpoint && (
            <button
              onClick={handleSaveCheckpoint}
              disabled={savingCheckpoint}
              className="text-sm px-3 py-1.5 rounded-md border border-gray-200
                         text-gray-600 hover:bg-gray-50 disabled:opacity-40
                         disabled:cursor-not-allowed transition-colors"
            >
              {savingCheckpoint ? 'Saving...' : 'Save version'}
            </button>
          )}

          {/* Version history toggle */}
          <button
            onClick={() => setShowVersionHistory((v) => !v)}
            className={`text-sm px-3 py-1.5 rounded-md border transition-colors
              ${showVersionHistory
                ? 'border-blue-200 bg-blue-50 text-blue-600'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
          >
            History
          </button>
        </div>
      </header>

      {/* ─── Body ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Editor — takes remaining width */}
        <main className="flex-1 overflow-hidden">
          <CollaborativeEditor
            noteId={noteId!}
            user={{ name: currentUserName, color: userColor }}
            initialContent={note.content}
          />
        </main>

        {/* Version history sidebar — slides in when toggled */}
        {showVersionHistory && (
          <aside className="w-72 border-l border-gray-200 shrink-0 overflow-hidden">
            <VersionHistoryPanel
              noteId={noteId!}
              canRestore={canRestore}
              onRestored={handleRestored}
            />
          </aside>
        )}

      </div>
    </div>
  )
}


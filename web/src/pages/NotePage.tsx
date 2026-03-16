// src/pages/NotePage.tsx
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getNote, createCheckpoint, updateNote } from '../api/notes.api'
import { CollaborativeEditor, type SaveStatus } from '../components/notes/CollaborativeEditor'
import { PresenceAvatars } from '../components/notes/PresenceAvatar'
import { VersionHistoryPanel } from '../components/notes/VersionHistoryPanel'
import { ConnectionStatus } from '../components/notes/ConnectionStatus'
import { SharePanel } from '../components/notes/SharePanel'
import { useNoteRoom } from '../hooks/useNoteRoom'
import { stringToColor } from '../lib/utils'
import { getAccessToken } from '../lib/auth'
import { socket } from '../lib/socket'
import {
  ArrowLeft, History, Share2, BookmarkPlus,
  CheckCircle2, AlertCircle, Loader2, FileText,
} from 'lucide-react'

interface Note {
  id: string
  title: string
  content: any
  ownerId: string
}

function decodeUserId(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.userId ?? null
  } catch {
    return null
  }
}

export function NotePage() {
  const { noteId } = useParams<{ noteId: string }>()
  const navigate = useNavigate()
  const token = getAccessToken()
  const currentUserId = token ? decodeUserId(token) : null

  const [note, setNote] = useState<Note | null>(null)
  const [loadingNote, setLoadingNote] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [savingCheckpoint, setSavingCheckpoint] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const flushEditorRef = useRef<(() => Promise<void>) | null>(null)

  // Tracks content version so the editor knows when to re-seed
  // after a version restore — incremented locally rather than
  // relying on latestVersionNumber from the backend
  const [contentVersion, setContentVersion] = useState(0)

  // Editable title state
  const [titleDraft, setTitleDraft] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const room = useNoteRoom(noteId!)
  const canRestore = room.canEdit
  const canSaveCheckpoint = room.canEdit
  const isOwner = room.role === 'OWNER'
  const userColor = stringToColor(currentUserId ?? '')
  const currentUserDisplayName =
    room.currentUser?.displayName || currentUserId?.slice(0, 8) || 'User'
  const currentUserEmail = room.currentUser?.email ?? null
  const effectiveCurrentUserId = room.currentUser?.userId || currentUserId || 'unknown-user'

  // Fix 8 — stable user object so the provider is never recreated
  // due to an inline object reference changing on every render
  const stableUser = useMemo(
    () => ({ name: currentUserDisplayName, color: userColor }),
    [currentUserDisplayName, userColor],
  )

  // ─── Initial note fetch ──────────────────────────────────────────────────

  const fetchNote = useCallback(async () => {
    if (!noteId) return
    try {
      setFetchError(null)
      const { note } = await getNote(noteId)
      setNote(note)
      setTitleDraft(note.title)
    } catch {
      setFetchError('Failed to load note')
    } finally {
      setLoadingNote(false)
    }
  }, [noteId])

  useEffect(() => {
    fetchNote()
  }, [fetchNote])

  // Redirect if not logged in
  useEffect(() => {
    if (!token) navigate('/login', { replace: true })
  }, [token, navigate])

  // Fix 16 — listen for version-restored broadcast from the server
  // so all collaborators re-seed their editor when anyone restores
  useEffect(() => {
    if (!noteId) return

    const onVersionRestored = (data: { noteId: string; content: unknown }) => {
      if (data.noteId !== noteId) return
      // Re-fetch so note.content is up to date, then bump
      // contentVersion to trigger the editor re-seed effect
      fetchNote().then(() => {
        setContentVersion((v) => v + 1)
      })
    }

    socket.on('notes:version-restored', onVersionRestored)
    return () => {
      socket.off('notes:version-restored', onVersionRestored)
    }
  }, [noteId, fetchNote])

// Flush on SPA navigation away — back button, notes list link etc.
useEffect(() => {
  return () => {
    if (flushEditorRef.current) {
      void flushEditorRef.current()
    }
  }
}, [])

  const leaveNote = useCallback(async () => {
    try {
      if (flushEditorRef.current) {
        await flushEditorRef.current()
      }
    } finally {
      navigate('/notes')
    }
  }, [navigate])

  // ─── Title editing ───────────────────────────────────────────────────────

  function startEditTitle() {
    if (!isOwner) return
    setEditingTitle(true)
    setTimeout(() => titleInputRef.current?.select(), 30)
  }

  async function commitTitle() {
    setEditingTitle(false)
    const trimmed = titleDraft.trim() || 'Untitled document'
    if (trimmed === note?.title) return
    try {
      await updateNote(noteId!, { title: trimmed })
      setNote((prev) => prev ? { ...prev, title: trimmed } : prev)
    } catch {
      setTitleDraft(note?.title ?? '')
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') (e.target as HTMLElement).blur()
    if (e.key === 'Escape') {
      setTitleDraft(note?.title ?? '')
      setEditingTitle(false)
    }
  }

  // ─── Checkpoint ──────────────────────────────────────────────────────────

  const handleSaveCheckpoint = async () => {
    if (!noteId) return
    try {
      setSavingCheckpoint(true)
      // Flush any pending autosave before creating the checkpoint
      // so the snapshot captures the absolute latest content
      if (flushEditorRef.current) {
        await flushEditorRef.current()
      }
      await createCheckpoint(noteId)
    } finally {
      setSavingCheckpoint(false)
    }
  }

  // ─── Restore ─────────────────────────────────────────────────────────────

  // Fix 16 — bump contentVersion after restore so the editor
  // re-seeds from the restored content for the user who clicked restore.
  // Other collaborators get the bump via the notes:version-restored socket event.
  const handleRestored = useCallback(() => {
    fetchNote().then(() => {
      setContentVersion((v) => v + 1)
    })
    setShowVersionHistory(false)
  }, [fetchNote])

  // Fix 9 — stable callback reference so persistContent inside
  // CollaborativeEditor never changes and doesn't trigger useEditor remount
  const handleSaveStatusChange = useCallback((status: SaveStatus) => {
    setSaveStatus(status)
  }, [])

  // ─── Loading / error states ───────────────────────────────────────────────

  if (loadingNote) {
    return (
      <div className="note-fullscreen-state">
        <Loader2 size={22} className="note-state-spinner" />
        <p>Loading note…</p>
      </div>
    )
  }

  if (fetchError || !note) {
    return (
      <div className="note-fullscreen-state">
        <FileText size={36} strokeWidth={1.3} color="#94a3b8" />
        <p>{fetchError ?? 'Note not found'}</p>
        <button onClick={() => { void leaveNote() }} className="text-link">
          ← Back to notes
        </button>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="note-page">

      {/* Connection banner */}
      <ConnectionStatus />

      {/* ─── Header ───────────────────────────────────────────────── */}
      <header className="note-header">

        {/* Left: back + title */}
        <div className="note-header__left">
          <button
            className="note-header__back"
            onClick={() => { void leaveNote() }}
            title="Back to notes"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="note-header__doc-icon">
            <FileText size={16} />
          </div>

          {editingTitle ? (
            <input
              ref={titleInputRef}
              className="note-header__title-input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={handleTitleKeyDown}
              maxLength={120}
            />
          ) : (
            <h1
              className={`note-header__title${isOwner ? ' note-header__title--editable' : ''}`}
              onClick={startEditTitle}
              title={isOwner ? 'Click to rename' : undefined}
            >
              {note.title || 'Untitled document'}
            </h1>
          )}

          {room.role && (
            <span className={`note-header__role note-header__role--${room.role.toLowerCase()}`}>
              {room.role.toLowerCase()}
            </span>
          )}
        </div>

        {/* Right: autosave + actions */}
        <div className="note-header__right">

          <SaveIndicator status={saveStatus} />

          {room.status === 'joined' && (
            // Fix 15 — pass initialPresence from room state so editors
            // see who is online immediately on join without missing
            // the presence-snapshot event
            <PresenceAvatars
              noteId={noteId!}
              initialPresence={room.initialPresence}
              currentUser={{
                userId: effectiveCurrentUserId,
                name: currentUserDisplayName,
                email: currentUserEmail,
                color: userColor,
                role: room.role!,
              }}
            />
          )}

          {canSaveCheckpoint && (
            <button
              onClick={handleSaveCheckpoint}
              disabled={savingCheckpoint}
              className="note-header__action-btn"
              title="Save version checkpoint"
            >
              <BookmarkPlus size={15} />
              <span>{savingCheckpoint ? 'Saving…' : 'Save version'}</span>
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => { setShowShare((v) => !v); setShowVersionHistory(false) }}
              className={`note-header__action-btn${showShare ? ' note-header__action-btn--active' : ''}`}
            >
              <Share2 size={15} />
              <span>Share</span>
            </button>
          )}

          <button
            onClick={() => { setShowVersionHistory((v) => !v); setShowShare(false) }}
            className={`note-header__action-btn${showVersionHistory ? ' note-header__action-btn--active' : ''}`}
          >
            <History size={15} />
            <span>History</span>
          </button>
        </div>
      </header>

      {/* ─── Body ─────────────────────────────────────────────────────── */}
      <div className="note-body">

        <main className="note-body__main">
          <CollaborativeEditor
            noteId={noteId!}
            // Fix 8 — stable reference, never recreates the provider
            user={stableUser}
            initialContent={note.content}
            // Fix 4/16 — local counter instead of latestVersionNumber
            // so restores always trigger a re-seed in the editor
            contentVersion={contentVersion}
            roomStatus={room.status}
            canEdit={room.canEdit}
            // Fix 9 — stable callback so persistContent doesn't change
            // reference and trigger useEditor remount
            onSaveStatusChange={handleSaveStatusChange}
            onRegisterFlush={(flush) => {
              flushEditorRef.current = flush
            }}
          />
        </main>

        {showShare && (
          <aside className="note-body__sidebar">
            <SharePanel
              noteId={noteId!}
              isOwner={isOwner}
              onClose={() => setShowShare(false)}
            />
          </aside>
        )}

        {showVersionHistory && !showShare && (
          <aside className="note-body__sidebar">
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

// ─── Save indicator ─────────────────────────────────────────────────────────

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  return (
    <div className={`note-save-indicator note-save-indicator--${status}`}>
      {status === 'saving' && <Loader2 size={12} className="note-state-spinner" />}
      {status === 'saved' && <CheckCircle2 size={12} />}
      {status === 'error' && <AlertCircle size={12} />}
      <span>
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save failed'}
      </span>
    </div>
  )
}
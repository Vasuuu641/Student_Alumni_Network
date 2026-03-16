// src/pages/NotePage.tsx
import { useEffect, useState, useCallback, useRef } from 'react'
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
import {
  ArrowLeft, History, Share2, BookmarkPlus,
  CheckCircle2, AlertCircle, Loader2, FileText,
} from 'lucide-react'

interface Note {
  id: string
  title: string
  content: any
  ownerId: string
  latestVersionNumber?: number | null
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
      if (flushEditorRef.current) {
        await flushEditorRef.current()
      }
      await createCheckpoint(noteId)
    } finally {
      setSavingCheckpoint(false)
    }
  }

  // ─── Restore ─────────────────────────────────────────────────────────────

  const handleRestored = useCallback(() => {
    fetchNote()
    setShowVersionHistory(false)
  }, [fetchNote])

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
        <button onClick={() => navigate('/notes')} className="text-link">
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
            onClick={() => navigate('/notes')}
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
            <PresenceAvatars
              noteId={noteId!}
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
            user={{ name: currentUserDisplayName, color: userColor }}
            initialContent={note.content}
            contentVersion={note.latestVersionNumber ?? null}
            roomStatus={room.status}
            canEdit={room.canEdit}
            onSaveStatusChange={setSaveStatus}
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


// src/pages/NotesListPage.tsx
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listUserNotes, createNote, updateNote, type Note, type NoteStatus } from '../api/notes.api'
import { getAccessToken } from '../lib/auth'
import { FileText, Plus, Clock, Archive, BookOpen, LogOut, ChevronRight } from 'lucide-react'

export function NotesListPage() {
  const navigate = useNavigate()
  const token = getAccessToken()

  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [filter, setFilter] = useState<NoteStatus | 'ALL'>('ALL')

  // Redirect if not logged in
  useEffect(() => {
    if (!token) navigate('/login', { replace: true })
  }, [token, navigate])

  const fetchNotes = useCallback(async () => {
    try {
      setError(null)
      const { notes } = await listUserNotes()
      setNotes(notes)
    } catch {
      setError('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const title = newTitle.trim() || 'Untitled document'
    try {
      setCreating(true)
      const { noteId } = await createNote(title)
      navigate(`/notes/${noteId}`)
    } catch {
      setError('Failed to create note')
      setCreating(false)
    }
  }

  async function handleArchive(noteId: string, current: NoteStatus, e: React.MouseEvent) {
    e.stopPropagation()
    const next: NoteStatus = current === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE'
    try {
      await updateNote(noteId, { status: next })
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, status: next } : n)))
    } catch {
      // silently fail
    }
  }

  function handleLogout() {
    localStorage.removeItem('unibridge.accessToken')
    localStorage.removeItem('unibridge.refreshToken')
    navigate('/login', { replace: true })
  }

  const filtered = notes.filter((n) => filter === 'ALL' || n.status === filter)
  const activeCount = notes.filter((n) => n.status === 'ACTIVE').length
  const archivedCount = notes.filter((n) => n.status === 'ARCHIVED').length

  return (
    <div className="notes-list-page">
      {/* ─── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="notes-sidebar">
        <div className="notes-sidebar__brand">
          <div className="brand-icon" style={{ width: '2.2rem', height: '2.2rem' }}>
            <BookOpen size={16} />
          </div>
          <span className="notes-sidebar__brand-name">UniBridge</span>
        </div>

        <nav className="notes-sidebar__nav">
          <button
            className={`notes-sidebar__nav-item ${filter === 'ALL' ? 'notes-sidebar__nav-item--active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            <FileText size={15} />
            <span>All notes</span>
            <span className="notes-sidebar__nav-count">{notes.length}</span>
          </button>
          <button
            className={`notes-sidebar__nav-item ${filter === 'ACTIVE' ? 'notes-sidebar__nav-item--active' : ''}`}
            onClick={() => setFilter('ACTIVE')}
          >
            <BookOpen size={15} />
            <span>Active</span>
            <span className="notes-sidebar__nav-count">{activeCount}</span>
          </button>
          <button
            className={`notes-sidebar__nav-item ${filter === 'ARCHIVED' ? 'notes-sidebar__nav-item--active' : ''}`}
            onClick={() => setFilter('ARCHIVED')}
          >
            <Archive size={15} />
            <span>Archived</span>
            <span className="notes-sidebar__nav-count">{archivedCount}</span>
          </button>
        </nav>

        <div className="notes-sidebar__footer">
          <button className="notes-sidebar__nav-item" onClick={() => navigate('/dashboard')}>
            <ChevronRight size={15} />
            <span>Dashboard</span>
          </button>
          <button className="notes-sidebar__nav-item" onClick={handleLogout}>
            <LogOut size={15} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* ─── Main ─────────────────────────────────────────────────────── */}
      <main className="notes-list-main">
        {/* Header */}
        <div className="notes-list-header">
          <div>
            <h1 className="notes-list-header__title">
              {filter === 'ALL' ? 'My Notes' : filter === 'ACTIVE' ? 'Active Notes' : 'Archived Notes'}
            </h1>
            <p className="notes-list-header__sub">
              {filtered.length} {filtered.length === 1 ? 'document' : 'documents'}
            </p>
          </div>
          <button
            className="notes-create-btn"
            onClick={() => setShowCreateForm((v) => !v)}
          >
            <Plus size={16} />
            New document
          </button>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <form onSubmit={handleCreate} className="notes-create-form">
            <div className="input-shell" style={{ flex: 1 }}>
              <div className="input-icon"><FileText size={16} /></div>
              <input
                className="input"
                placeholder="Document title (optional)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="submit-button submit-button--wide"
              style={{ minHeight: '2.9rem', fontSize: '0.9rem' }}
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="notes-cancel-btn"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Error */}
        {error && (
          <div className="status-banner status-banner--error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="notes-empty-state">
            <p>Loading notes…</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="notes-empty-state">
            <FileText size={40} strokeWidth={1.2} color="#94a3b8" />
            <p>
              {filter === 'ARCHIVED'
                ? 'No archived notes.'
                : 'No notes yet. Create one to get started.'}
            </p>
            {filter !== 'ARCHIVED' && (
              <button
                className="hero-button hero-button--primary"
                style={{ padding: '0.6rem 1.4rem', fontSize: '0.9rem', borderRadius: '0.6rem' }}
                onClick={() => setShowCreateForm(true)}
              >
                Create first note
              </button>
            )}
          </div>
        )}

        {/* Notes grid */}
        {!loading && filtered.length > 0 && (
          <div className="notes-grid">
            {filtered.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => navigate(`/notes/${note.id}`)}
                onArchive={(e) => handleArchive(note.id, note.status, e)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Note Card ─────────────────────────────────────────────────────────────

interface NoteCardProps {
  note: Note
  onClick: () => void
  onArchive: (e: React.MouseEvent) => void
}

function NoteCard({ note, onClick, onArchive }: NoteCardProps) {
  return (
    <div className="note-card" onClick={onClick}>
      <div className="note-card__icon">
        <FileText size={20} />
      </div>
      <div className="note-card__body">
        <h3 className="note-card__title">{note.title || 'Untitled document'}</h3>
        <div className="note-card__meta">
          <Clock size={11} />
          <span>{formatRelativeDate(note.updatedAt)}</span>
        </div>
      </div>
      <div className="note-card__actions">
        {note.status === 'ARCHIVED' && (
          <span className="note-card__badge note-card__badge--archived">Archived</span>
        )}
        <button
          className="note-card__archive-btn"
          onClick={onArchive}
          title={note.status === 'ACTIVE' ? 'Archive' : 'Restore'}
        >
          <Archive size={14} />
        </button>
      </div>
    </div>
  )
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// src/pages/NotesListPage.tsx
import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { listUserNotes, createNote, updateNote, type Note, type NoteStatus } from '../api/notes.api'
import { getAccessToken } from '../lib/auth'
import { FileText, Plus, Clock, Archive } from 'lucide-react'
import { PlatformTopNav } from '../components/PlatformTopNav'

type NoteFilter = NoteStatus | 'ALL'

export function NotesListPage() {
  const navigate = useNavigate()
  const token = getAccessToken()

  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [filter, setFilter] = useState<NoteFilter>('ALL')

  // Redirect if not logged in
  if (!token) {
    return <Navigate to="/login" replace />
  }

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

  const filtered = notes.filter((n) => filter === 'ALL' || n.status === filter)
  const activeCount = notes.filter((n) => n.status === 'ACTIVE').length
  const archivedCount = notes.filter((n) => n.status === 'ARCHIVED').length

  const filterOptions: Array<{ label: string; value: NoteFilter; count: number }> = [
    { label: 'All notes', value: 'ALL', count: notes.length },
    { label: 'Active', value: 'ACTIVE', count: activeCount },
    { label: 'Archived', value: 'ARCHIVED', count: archivedCount },
  ]

  return (
    <main className="notes-list-page-modern">
      <PlatformTopNav />

      <div className="notes-list-container">
        {/* ─── Header Row ──────────────────────────────────────────────── */}
        <div className="notes-list-header-modern">
          <div>
            <h1 className="notes-list-title">
              {filter === 'ALL' ? 'My Notes' : filter === 'ACTIVE' ? 'Active Notes' : 'Archived Notes'}
            </h1>
            <p className="notes-list-subtitle">
              {filtered.length} {filtered.length === 1 ? 'document' : 'documents'}
            </p>
          </div>
          <button
            className="notes-create-btn-modern"
            onClick={() => setShowCreateForm((v) => !v)}
          >
            <Plus size={16} />
            New document
          </button>
        </div>

        {/* ─── Filter Tabs ──────────────────────────────────────────────── */}
        <div className="notes-filter-tabs">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              className={`notes-filter-tab ${filter === option.value ? 'notes-filter-tab--active' : ''}`}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
              <span className="notes-filter-count">{option.count}</span>
            </button>
          ))}
        </div>

        {/* ─── Create form ──────────────────────────────────────────────── */}
        {showCreateForm && (
          <form onSubmit={handleCreate} className="notes-create-form-modern">
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

        {/* ─── Error ────────────────────────────────────────────────────── */}
        {error && (
          <div className="status-banner status-banner--error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* ─── Content ──────────────────────────────────────────────────── */}
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
      </div>
    </main>
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

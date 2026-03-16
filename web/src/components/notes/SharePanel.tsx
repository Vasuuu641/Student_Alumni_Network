// src/components/notes/SharePanel.tsx
import { useState, useEffect, useCallback } from 'react'
import {
  listCollaborators,
  shareNote,
  updateCollaboratorRole,
  removeCollaborator,
  type NoteCollaborator,
  type NoteRole,
} from '../../api/notes.api'
import { UserPlus, Trash2, ChevronDown, X, Users } from 'lucide-react'

interface Props {
  noteId: string
  isOwner: boolean
  onClose: () => void
}

export function SharePanel({ noteId, isOwner, onClose }: Props) {
  const [collaborators, setCollaborators] = useState<NoteCollaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer')
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareSuccess, setShareSuccess] = useState(false)

  const fetchCollaborators = useCallback(async () => {
    try {
      setError(null)
      const { collaborators } = await listCollaborators(noteId)
      setCollaborators(collaborators)
    } catch {
      setError('Failed to load collaborators')
    } finally {
      setLoading(false)
    }
  }, [noteId])

  useEffect(() => {
    fetchCollaborators()
  }, [fetchCollaborators])

  async function handleShare(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    try {
      setShareError(null)
      setSharing(true)
      await shareNote(noteId, email.trim(), role)
      setEmail('')
      setShareSuccess(true)
      setTimeout(() => setShareSuccess(false), 2500)
      fetchCollaborators()
    } catch (err: any) {
      const message = err?.response?.data?.message
      setShareError(Array.isArray(message) ? message.join(', ') : (message ?? 'Failed to share note'))
    } finally {
      setSharing(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: 'editor' | 'viewer') {
    try {
      await updateCollaboratorRole(noteId, userId, newRole)
      setCollaborators((prev) =>
        prev.map((c) =>
          c.userId === userId
            ? { ...c, role: newRole.toUpperCase() as NoteRole }
            : c,
        ),
      )
    } catch {
      setError('Failed to update role')
    }
  }

  async function handleRemove(userId: string) {
    try {
      await removeCollaborator(noteId, userId)
      setCollaborators((prev) => prev.filter((c) => c.userId !== userId))
    } catch {
      setError('Failed to remove collaborator')
    }
  }

  return (
    <div className="share-panel">
      {/* Header */}
      <div className="share-panel__header">
        <div className="share-panel__title">
          <Users size={16} />
          <span>Share document</span>
        </div>
        <button className="share-panel__close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Invite form — only owner can share */}
      {isOwner && (
        <form onSubmit={handleShare} className="share-panel__invite">
          <div className="share-panel__invite-row">
            <input
              className="share-panel__email-input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="share-panel__role-select-wrap">
              <select
                className="share-panel__role-select"
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <ChevronDown size={12} className="share-panel__role-caret" />
            </div>
          </div>

          {shareError && (
            <p className="share-panel__share-error">{shareError}</p>
          )}
          {shareSuccess && (
            <p className="share-panel__share-success">Invitation sent!</p>
          )}

          <button type="submit" disabled={sharing} className="share-panel__invite-btn">
            <UserPlus size={14} />
            {sharing ? 'Sharing…' : 'Share'}
          </button>
        </form>
      )}

      {/* Collaborators list */}
      <div className="share-panel__list-wrap">
        <p className="share-panel__list-label">
          {loading ? 'Loading…' : `${collaborators.length} ${collaborators.length === 1 ? 'collaborator' : 'collaborators'}`}
        </p>

        {error && (
          <p className="share-panel__list-error">{error}</p>
        )}

        <ul className="share-panel__list">
          {collaborators.map((c) => (
            <CollaboratorRow
              key={c.userId}
              collaborator={c}
              isOwner={isOwner}
              onRoleChange={handleRoleChange}
              onRemove={handleRemove}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── Row ────────────────────────────────────────────────────────────────────

interface RowProps {
  collaborator: NoteCollaborator
  isOwner: boolean
  onRoleChange: (userId: string, role: 'editor' | 'viewer') => void
  onRemove: (userId: string) => void
}

function CollaboratorRow({ collaborator, isOwner, onRoleChange, onRemove }: RowProps) {
  const initials = collaborator.email.slice(0, 2).toUpperCase()
  const isOwnerRow = collaborator.role === 'OWNER'

  return (
    <li className="share-panel__row">
      <div className="share-panel__avatar">{initials}</div>
      <div className="share-panel__row-info">
        <span className="share-panel__row-email">{collaborator.email}</span>
        <span className={`share-panel__role-badge share-panel__role-badge--${collaborator.role.toLowerCase()}`}>
          {collaborator.role.toLowerCase()}
        </span>
      </div>
      {isOwner && !isOwnerRow && (
        <div className="share-panel__row-actions">
          <select
            value={collaborator.role.toLowerCase()}
            onChange={(e) => onRoleChange(collaborator.userId, e.target.value as 'editor' | 'viewer')}
            className="share-panel__role-select share-panel__role-select--inline"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button
            className="share-panel__remove-btn"
            onClick={() => onRemove(collaborator.userId)}
            title="Remove"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </li>
  )
}

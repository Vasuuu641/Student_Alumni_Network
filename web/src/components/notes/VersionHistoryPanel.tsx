// src/components/notes/VersionHistoryPanel.tsx
import { useEffect, useState, useCallback } from 'react'
import { listVersions, restoreVersion } from '../../api/notes.api'
import { useCheckpointEvents } from '../../hooks/useCheckpointEvents'
import { VersionPreviewModal } from './VersionPreviewModal'
import { Clock, History } from 'lucide-react'

interface NoteVersion {
  versionNumber: number
  createdAt: string
  createdBy?: string
  snapshotJson?: unknown
}

interface Props {
  noteId: string
  canRestore: boolean
  onRestored: () => void
}

export function VersionHistoryPanel({ noteId, canRestore, onRestored }: Props) {
  const [versions, setVersions] = useState<NoteVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null)

  // ─── Fetch versions ──────────────────────────────────────────────────────

  const fetchVersions = useCallback(async () => {
    try {
      setError(null)
      const { versions } = await listVersions(noteId)
      setVersions(versions)
    } catch {
      setError('Failed to load version history')
    } finally {
      setLoading(false)
    }
  }, [noteId])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  // Auto-refresh when a new checkpoint is broadcast
  useCheckpointEvents(noteId, useCallback(() => {
    fetchVersions()
  }, [fetchVersions]))

  // ─── Restore ─────────────────────────────────────────────────────────────

  async function handleRestore(version: NoteVersion) {
    try {
      setRestoring(version.versionNumber)
      await restoreVersion(noteId, version.versionNumber)
      setSelectedVersion(null)
      onRestored()
    } catch {
      setError(`Failed to restore version ${version.versionNumber}`)
      setRestoring(null)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="version-panel">
        <div className="version-panel__header">
          <History size={15} />
          <div>
            <h3 className="version-panel__title">Version history</h3>
            <p className="version-panel__sub">Checkpoints saved by collaborators</p>
          </div>
        </div>

        <div className="version-panel__list">
          {loading && (
            <div className="version-panel__state">Loading versions…</div>
          )}

          {error && (
            <div className="version-panel__error">{error}</div>
          )}

          {!loading && versions.length === 0 && (
            <div className="version-panel__state">
              <Clock size={28} strokeWidth={1.3} color="#94a3b8" />
              <p>No versions saved yet</p>
            </div>
          )}

          {!loading && versions.length > 0 && (
            <ul className="version-panel__items">
              {versions.map((version) => (
                <li
                  key={version.versionNumber}
                  className="version-panel__item"
                  onClick={() => setSelectedVersion(version)}
                >
                  <div className="version-panel__item-dot" />
                  <div className="version-panel__item-body">
                    <span className="version-panel__item-label">
                      Version {version.versionNumber}
                    </span>
                    <span className="version-panel__item-date">
                      {formatDate(version.createdAt)}
                    </span>
                    <span className="version-panel__item-by">
                      by {(version.createdBy ?? 'unknown').slice(0, 8)}…
                    </span>
                  </div>
                  {canRestore && (
                    <button
                      className="version-panel__restore-btn"
                      onClick={(e) => { e.stopPropagation(); setSelectedVersion(version) }}
                    >
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {selectedVersion && (
        <VersionPreviewModal
          version={selectedVersion}
          canRestore={canRestore}
          restoring={restoring === selectedVersion.versionNumber}
          onRestore={() => handleRestore(selectedVersion)}
          onClose={() => setSelectedVersion(null)}
        />
      )}
    </>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
// src/components/notes/VersionHistoryPanel.tsx
import { useEffect, useState, useCallback } from 'react'
import { listVersions, restoreVersion } from '../../api/notes.api'
import { useCheckpointEvents } from '../../hooks/useCheckpointEvents'

interface NoteVersion {
  versionNumber: number
  createdAt: string
  createdBy: string
}

interface Props {
  noteId: string
  // Only owners can restore — pass this down from room state
  canRestore: boolean
  onRestored: () => void
}

export function VersionHistoryPanel({ noteId, canRestore, onRestored }: Props) {
  const [versions, setVersions] = useState<NoteVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  // ─── Auto-refresh when a new checkpoint is broadcast ────────────────────

  const handleCheckpoint = useCallback(() => {
    fetchVersions()
  }, [fetchVersions])

  useCheckpointEvents(noteId, handleCheckpoint)

  // ─── Restore ─────────────────────────────────────────────────────────────

  async function handleRestore(versionNumber: number) {
    if (!canRestore) return
    const confirmed = window.confirm(
      `Restore to version ${versionNumber}? Current content will be overwritten.`,
    )
    if (!confirmed) return

    try {
      setRestoring(versionNumber)
      await restoreVersion(noteId, versionNumber)
      onRestored()
    } catch {
      setError(`Failed to restore version ${versionNumber}`)
    } finally {
      setRestoring(null)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">Version history</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Checkpoints saved by collaborators
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-24 text-sm text-gray-400">
            Loading versions...
          </div>
        )}

        {error && (
          <div className="mx-4 mt-4 px-3 py-2 bg-red-50 text-red-600
                          text-sm rounded-md">
            {error}
          </div>
        )}

        {!loading && versions.length === 0 && (
          <div className="flex items-center justify-center h-24
                          text-sm text-gray-400">
            No versions saved yet
          </div>
        )}

        {!loading && versions.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {versions.map((version) => (
              <li
                key={version.versionNumber}
                className="px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-gray-900">
                      Version {version.versionNumber}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(version.createdAt)}
                    </span>
                    <span className="text-xs text-gray-400">
                      by {version.createdBy}
                    </span>
                  </div>

                  {canRestore && (
                    <button
                      onClick={() => handleRestore(version.versionNumber)}
                      disabled={restoring === version.versionNumber}
                      className="shrink-0 text-xs px-2 py-1 rounded
                                 text-blue-600 hover:bg-blue-50
                                 disabled:opacity-40 disabled:cursor-not-allowed
                                 transition-colors"
                    >
                      {restoring === version.versionNumber
                        ? 'Restoring...'
                        : 'Restore'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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
// src/components/notes/VersionPreviewModal.tsx
import { X, Clock, RotateCcw } from 'lucide-react'

interface NoteVersion {
  versionNumber: number
  createdAt: string
  createdBy: string
}

interface Props {
  version: NoteVersion
  canRestore: boolean
  restoring: boolean
  onRestore: () => void
  onClose: () => void
}

export function VersionPreviewModal({
  version,
  canRestore,
  restoring,
  onRestore,
  onClose,
}: Props) {
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="version-modal-overlay" onClick={handleOverlayClick}>
      <div className="version-modal">
        <div className="version-modal__header">
          <div className="version-modal__title">
            <Clock size={15} />
            <span>Version {version.versionNumber}</span>
          </div>
          <button className="version-modal__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="version-modal__body">
          <dl className="version-modal__meta">
            <div className="version-modal__meta-row">
              <dt>Saved</dt>
              <dd>{formatDate(version.createdAt)}</dd>
            </div>
            <div className="version-modal__meta-row">
              <dt>By</dt>
              <dd className="version-modal__by">{version.createdBy.slice(0, 8)}…</dd>
            </div>
          </dl>

          <p className="version-modal__desc">
            This checkpoint was manually saved by a collaborator. Restoring it will
            overwrite the current document content.
          </p>
        </div>

        <div className="version-modal__footer">
          <button className="version-modal__cancel" onClick={onClose}>
            Cancel
          </button>
          {canRestore && (
            <button
              className="version-modal__restore"
              onClick={onRestore}
              disabled={restoring}
            >
              <RotateCcw size={13} />
              {restoring ? 'Restoring…' : 'Restore this version'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

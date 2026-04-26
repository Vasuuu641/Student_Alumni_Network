import { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, MessageCircle, TrendingUp, Loader2 } from 'lucide-react'
import { getThread, listReplies, type Thread, type ThreadReply } from '../../api/threads.api'
import type { RelatedThread } from '../../api/notes.api'

interface RelatedThreadsPanelProps {
  threads: RelatedThread[]
  isLoading: boolean
  hasRequested: boolean
  canRequestSuggestions: boolean
  cooldownRemainingMs: number
  onRequestSuggestions: () => void
  onClose: () => void
}

function getSimilarityColor(score: number): string {
  if (score >= 0.8) return 'text-green-600'
  if (score >= 0.7) return 'text-blue-600'
  if (score >= 0.6) return 'text-amber-600'
  return 'text-gray-600'
}

export function RelatedThreadsPanel({
  threads,
  isLoading,
  hasRequested,
  canRequestSuggestions,
  cooldownRemainingMs,
  onRequestSuggestions,
  onClose,
}: RelatedThreadsPanelProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [selectedReplies, setSelectedReplies] = useState<ThreadReply[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const cooldownSeconds = Math.ceil(cooldownRemainingMs / 1000)

  const hasPreviewOpen = selectedThreadId !== null

  const previewThreadSummary = useMemo(
    () => threads.find((thread) => thread.threadId === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  )

  const openThreadPreview = useCallback(async (threadId: string) => {
    setSelectedThreadId(threadId)
    setPreviewLoading(true)
    setPreviewError(null)

    try {
      const [{ thread }, { replies }] = await Promise.all([
        getThread(threadId),
        listReplies({ threadId, sortBy: 'newest', take: 100 }),
      ])
      setSelectedThread(thread)
      const chronologicalReplies = replies
        .filter((reply) => reply.status !== 'DELETED')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      setSelectedReplies(chronologicalReplies)
    } catch (error) {
      setSelectedThread(null)
      setSelectedReplies([])
      setPreviewError(error instanceof Error ? error.message : 'Failed to load discussion')
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  const closePreview = useCallback(() => {
    setSelectedThreadId(null)
    setSelectedThread(null)
    setSelectedReplies([])
    setPreviewError(null)
    setPreviewLoading(false)
  }, [])

  return (
    <aside className="notes-llm-panel">
      {/* Header */}
      <div className="notes-llm-header">
        <div className="notes-llm-header-title">
          <div className="notes-llm-icon">💡</div>
          <h3>{hasPreviewOpen ? 'Discussion Preview' : 'Related Discussions'}</h3>
        </div>
        <button
          onClick={onClose}
          className="notes-llm-close"
          title="Close related discussions"
        >
          ×
        </button>
      </div>

      <div className="notes-llm-actions">
        {hasPreviewOpen ? (
          <button
            type="button"
            className="notes-llm-request-btn notes-llm-request-btn--ghost"
            onClick={closePreview}
          >
            <ArrowLeft size={14} />
            <span>Back to suggestions</span>
          </button>
        ) : (
          <button
            type="button"
            className="notes-llm-request-btn"
            onClick={onRequestSuggestions}
            disabled={isLoading || !canRequestSuggestions || cooldownRemainingMs > 0}
          >
            {isLoading
              ? 'Finding suggestions…'
              : cooldownRemainingMs > 0
                ? `Try again in ${cooldownSeconds}s`
                : 'Get AI Suggestions'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="notes-llm-content">
        {hasPreviewOpen ? (
          <div className="notes-llm-preview">
            {previewLoading ? (
              <div className="notes-llm-loading">
                <Loader2 size={18} className="notes-llm-spinner" />
                <span>Loading discussion…</span>
              </div>
            ) : previewError ? (
              <div className="notes-llm-empty">
                <MessageCircle size={20} />
                <p>{previewError}</p>
              </div>
            ) : selectedThread ? (
              <>
                <article className="notes-llm-preview-thread">
                  <h4>{selectedThread.title}</h4>
                  {selectedThread.description ? (
                    <p>{selectedThread.description}</p>
                  ) : (
                    <p className="notes-llm-preview-thread-empty">No description provided.</p>
                  )}
                  <div className="notes-llm-preview-meta">
                    <span>{selectedThread.panel === 'ACADEMIC' ? 'Academic' : 'Alumni'}</span>
                    <span>{selectedThread.replyCount} replies</span>
                    <span>{selectedThread.voteScore > 0 ? `+${selectedThread.voteScore}` : selectedThread.voteScore} score</span>
                  </div>
                  {previewThreadSummary && (
                    <div className="notes-llm-preview-similarity">
                      {(previewThreadSummary.similarityScore * 100).toFixed(0)}% similarity match
                    </div>
                  )}
                </article>

                <section className="notes-llm-preview-replies">
                  <h5>Replies ({selectedReplies.length})</h5>
                  {selectedReplies.length === 0 ? (
                    <div className="notes-llm-empty notes-llm-empty--compact">
                      <MessageCircle size={16} />
                      <p>No replies yet.</p>
                    </div>
                  ) : (
                    <div className="notes-llm-reply-list">
                      {selectedReplies.map((reply) => (
                        <article key={reply.id} className="notes-llm-reply-item">
                          <header>
                            <strong>{reply.authorName ?? 'Unknown user'}</strong>
                            <span>{reply.voteScore > 0 ? `+${reply.voteScore}` : reply.voteScore} score</span>
                          </header>
                          <p>{reply.content}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : (
              <div className="notes-llm-empty">
                <MessageCircle size={20} />
                <p>Select a suggestion to preview the discussion.</p>
              </div>
            )}
          </div>
        ) : isLoading ? (
          <div className="notes-llm-loading">
            <Loader2 size={18} className="notes-llm-spinner" />
            <span>Finding discussions…</span>
          </div>
        ) : threads.length === 0 ? (
          <div className="notes-llm-empty">
            <MessageCircle size={20} />
            <p>
              {!hasRequested
                ? 'Press Get AI Suggestions to find related discussions.'
                : canRequestSuggestions
                  ? 'No related discussions found for this note yet.'
                  : 'Write a bit more before requesting suggestions.'}
            </p>
          </div>
        ) : (
          <div className="notes-llm-threads">
            {threads.map((thread) => (
              <div
                key={thread.threadId}
                className="notes-llm-thread-card"
                onClick={() => {
                  void openThreadPreview(thread.threadId)
                }}
              >
                {/* Similarity score */}
                <div className={`notes-llm-similarity ${getSimilarityColor(thread.similarityScore)}`}>
                  <span className="notes-llm-similarity-value">
                    {(thread.similarityScore * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Content */}
                <div className="notes-llm-card-content">
                  <h4 className="notes-llm-thread-title">{thread.title}</h4>
                  
                  {thread.description && (
                    <p className="notes-llm-thread-description">
                      {thread.description.length > 100
                        ? `${thread.description.slice(0, 100)}…`
                        : thread.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="notes-llm-stats">
                    <div className="notes-llm-stat">
                      <MessageCircle size={14} />
                      <span>{thread.replyCount}</span>
                    </div>
                    <div className="notes-llm-stat">
                      <TrendingUp size={14} />
                      <span>{thread.voteScore > 0 ? `+${thread.voteScore}` : thread.voteScore}</span>
                    </div>
                  </div>

                  {/* Panel badge */}
                  <div className="notes-llm-panel-badge">
                    {thread.panel === 'ACADEMIC' ? '📚 Academic' : '💼 Alumni'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="notes-llm-footer">
        <p>
          {hasPreviewOpen
            ? 'Browse thread details and replies without leaving your note.'
            : 'Suggestions are fetched only when you request them.'}
        </p>
      </div>
    </aside>
  )
}

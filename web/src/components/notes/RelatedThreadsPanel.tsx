import { MessageCircle, TrendingUp, ExternalLink, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { RelatedThread } from '../../api/notes.api'

interface RelatedThreadsPanelProps {
  threads: RelatedThread[]
  isLoading: boolean
  onClose: () => void
}

function getSimilarityColor(score: number): string {
  if (score >= 0.8) return 'text-green-600'
  if (score >= 0.7) return 'text-blue-600'
  if (score >= 0.6) return 'text-amber-600'
  return 'text-gray-600'
}

export function RelatedThreadsPanel({ threads, isLoading, onClose }: RelatedThreadsPanelProps) {
  const navigate = useNavigate()

  const handleThreadClick = (threadId: string) => {
    navigate(`/threads/${threadId}`)
  }

  return (
    <aside className="notes-llm-panel">
      {/* Header */}
      <div className="notes-llm-header">
        <div className="notes-llm-header-title">
          <div className="notes-llm-icon">💡</div>
          <h3>Related Discussions</h3>
        </div>
        <button
          onClick={onClose}
          className="notes-llm-close"
          title="Close related discussions"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="notes-llm-content">
        {isLoading ? (
          <div className="notes-llm-loading">
            <Loader2 size={18} className="notes-llm-spinner" />
            <span>Finding discussions…</span>
          </div>
        ) : threads.length === 0 ? (
          <div className="notes-llm-empty">
            <MessageCircle size={20} />
            <p>Write more to find similar discussions</p>
          </div>
        ) : (
          <div className="notes-llm-threads">
            {threads.map((thread) => (
              <div
                key={thread.threadId}
                className="notes-llm-thread-card"
                onClick={() => handleThreadClick(thread.threadId)}
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

                {/* External link indicator */}
                <div className="notes-llm-external">
                  <ExternalLink size={14} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="notes-llm-footer">
        <p>Real-time suggestions as you write</p>
      </div>
    </aside>
  )
}

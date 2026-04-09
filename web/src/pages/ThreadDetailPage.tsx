import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowBigDown, ArrowBigUp, ArrowLeft, MessageCircle, Send } from 'lucide-react'
import {
  createThreadsSocket,
  deleteReply,
  editReply,
  getThread,
  listReplies,
  postReply,
  updateThreadStatus,
  voteReply,
  voteThread,
  type Thread,
  type ThreadReply,
  type VoteType,
} from '../api/threads.api'
import { getAccessToken } from '../lib/auth'

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
  ) {
    const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
    if (Array.isArray(message) && message.length > 0) return message.join(', ')
    if (typeof message === 'string' && message.trim()) return message
  }

  if (error instanceof Error && error.message) return error.message
  return fallback
}

function decodeUserId(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      userId?: string
    }
    return payload.userId ?? null
  } catch {
    return null
  }
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
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function getVoteTransition(
  previousVote: VoteType | null | undefined,
  clickedVote: VoteType,
): {
  nextVote: VoteType | null
  scoreDelta: number
  upvoteDelta: number
  downvoteDelta: number
} {
  const prev = previousVote ?? null
  const nextVote = prev === clickedVote ? null : clickedVote

  const scoreByVote = (vote: VoteType | null): number => {
    if (vote === 'UPVOTE') return 1
    if (vote === 'DOWNVOTE') return -1
    return 0
  }

  const scoreDelta = scoreByVote(nextVote) - scoreByVote(prev)
  const upvoteDelta = (nextVote === 'UPVOTE' ? 1 : 0) - (prev === 'UPVOTE' ? 1 : 0)
  const downvoteDelta = (nextVote === 'DOWNVOTE' ? 1 : 0) - (prev === 'DOWNVOTE' ? 1 : 0)

  return { nextVote, scoreDelta, upvoteDelta, downvoteDelta }
}

export function ThreadDetailPage() {
  const navigate = useNavigate()
  const { threadId } = useParams<{ threadId: string }>()
  const token = getAccessToken()
  const currentUserId = token ? decodeUserId(token) : null

  const [thread, setThread] = useState<Thread | null>(null)
  const [replies, setReplies] = useState<ThreadReply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [postingReply, setPostingReply] = useState(false)
  const [updatingThreadStatus, setUpdatingThreadStatus] = useState(false)
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null)
  const [editingReplyDraft, setEditingReplyDraft] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingReplyVoteId, setPendingReplyVoteId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<ThreadReply | null>(null)

  const socketRef = useRef<ReturnType<typeof createThreadsSocket> | null>(null)
  const repliesRef = useRef<ThreadReply[]>([])

  useEffect(() => {
    repliesRef.current = replies
  }, [replies])

  const appendReplyIfMissing = useCallback((incomingReply: ThreadReply) => {
    let didAppend = false

    setReplies((prev) => {
      if (prev.some((reply) => reply.id === incomingReply.id)) {
        return prev
      }

      didAppend = true
      return [incomingReply, ...prev]
    })

    if (didAppend) {
      setThread((prev) => (prev ? { ...prev, replyCount: prev.replyCount + 1 } : prev))
    }
  }, [])

  const removeReplyIfPresent = useCallback((replyId: string) => {
    let didRemove = false

    setReplies((prev) => {
      if (!prev.some((reply) => reply.id === replyId)) {
        return prev
      }

      didRemove = true
      return prev.filter((reply) => reply.id !== replyId)
    })

    if (didRemove) {
      setThread((prev) => (prev
        ? { ...prev, replyCount: Math.max(0, prev.replyCount - 1) }
        : prev))
    }
  }, [])

  const loadThread = useCallback(async () => {
    if (!threadId) return

    try {
      setError(null)
      setLoading(true)
      const [{ thread: loadedThread }, { replies: loadedReplies }] = await Promise.all([
        getThread(threadId),
        listReplies({ threadId, sortBy: 'newest', take: 100 }),
      ])

      setThread(loadedThread)
      setReplies(loadedReplies.filter((reply) => reply.status !== 'DELETED'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load discussion')
    } finally {
      setLoading(false)
    }
  }, [threadId])

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    void loadThread()
  }, [token, navigate, loadThread])

  useEffect(() => {
    if (!threadId || !token) return

    const socket = createThreadsSocket(token)
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('threads:join', { threadId })
    })

    socket.on('threads:reply-posted', (payload: { threadId: string; reply: ThreadReply }) => {
      if (payload.threadId !== threadId) return
      if (payload.reply.status === 'DELETED') return
      appendReplyIfMissing(payload.reply)
    })

    socket.on('threads:reply-voted', (payload: {
      threadId: string
      replyId: string
      voteScore: number
      upvoteCount: number
      downvoteCount: number
    }) => {
      if (payload.threadId !== threadId) return
      setReplies((prev) => prev.map((reply) => (
        reply.id === payload.replyId
          ? {
            ...reply,
            voteScore: payload.voteScore,
            upvoteCount: payload.upvoteCount,
            downvoteCount: payload.downvoteCount,
          }
          : reply
      )))
    })

    socket.on('threads:thread-voted', (payload: {
      threadId: string
      voteScore: number
      upvoteCount: number
      downvoteCount: number
    }) => {
      if (payload.threadId !== threadId) return
      setThread((prev) => (prev
        ? {
          ...prev,
          voteScore: payload.voteScore,
          upvoteCount: payload.upvoteCount,
          downvoteCount: payload.downvoteCount,
        }
        : prev))
    })

    socket.on('threads:reply-edited', (payload: { threadId: string; replyId: string; content: string }) => {
      if (payload.threadId !== threadId) return
      setReplies((prev) => prev.map((reply) => (
        reply.id === payload.replyId
          ? { ...reply, content: payload.content, status: 'EDITED' }
          : reply
      )))
    })

    socket.on('threads:reply-deleted', (payload: { threadId: string; replyId: string }) => {
      if (payload.threadId !== threadId) return
      removeReplyIfPresent(payload.replyId)
    })

    return () => {
      socket.emit('threads:leave', { threadId })
      socket.disconnect()
      socketRef.current = null
    }
  }, [threadId, token, appendReplyIfMissing, removeReplyIfPresent])

  const threadAuthorLabel = useMemo(() => {
    if (!thread) return ''
    return thread.authorName ?? thread.authorId.slice(0, 8)
  }, [thread])

  const repliesByParent = useMemo(() => {
    const map = new Map<string | null, ThreadReply[]>()

    for (const reply of replies) {
      const key = reply.parentReplyId ?? null
      const existing = map.get(key)
      if (existing) {
        existing.push(reply)
      } else {
        map.set(key, [reply])
      }
    }

    return map
  }, [replies])

  const isThreadAuthor = !!thread && !!currentUserId && thread.authorId === currentUserId
  const canReplyToThread = thread?.status === 'OPEN' || thread?.status === 'PINNED'

  async function handleVoteThread(voteType: 'UPVOTE' | 'DOWNVOTE') {
    if (!threadId || !thread) return

    const previousVote = thread.viewerVote ?? null
    const transition = getVoteTransition(previousVote, voteType)

    try {
      setActionError(null)
      setThread((prev) => (prev
        ? {
          ...prev,
          voteScore: prev.voteScore + transition.scoreDelta,
          upvoteCount: Math.max(0, (prev.upvoteCount ?? 0) + transition.upvoteDelta),
          downvoteCount: Math.max(0, (prev.downvoteCount ?? 0) + transition.downvoteDelta),
          viewerVote: transition.nextVote,
        }
        : prev))
      await voteThread(threadId, voteType)
    } catch (err) {
      setThread((prev) => (prev
        ? {
          ...prev,
          voteScore: prev.voteScore - transition.scoreDelta,
          upvoteCount: Math.max(0, (prev.upvoteCount ?? 0) - transition.upvoteDelta),
          downvoteCount: Math.max(0, (prev.downvoteCount ?? 0) - transition.downvoteDelta),
          viewerVote: previousVote,
        }
        : prev))
      setActionError(getErrorMessage(err, 'Failed to register thread vote.'))
    }
  }

  async function handleVoteReply(replyId: string, voteType: 'UPVOTE' | 'DOWNVOTE') {
    if (!threadId) return

    const targetReply = repliesRef.current.find((reply) => reply.id === replyId)
    if (!targetReply) return

    const previousVote = targetReply.viewerVote ?? null
    const transition = getVoteTransition(previousVote, voteType)

    try {
      setActionError(null)
      setPendingReplyVoteId(replyId)

      setReplies((prev) => prev.map((reply) => (
        reply.id === replyId
          ? {
            ...reply,
            voteScore: reply.voteScore + transition.scoreDelta,
            upvoteCount: Math.max(0, (reply.upvoteCount ?? 0) + transition.upvoteDelta),
            downvoteCount: Math.max(0, (reply.downvoteCount ?? 0) + transition.downvoteDelta),
            viewerVote: transition.nextVote,
          }
          : reply
      )))

      await voteReply({ threadId, replyId, voteType })
    } catch (err) {
      setReplies((prev) => prev.map((reply) => (
        reply.id === replyId
          ? {
            ...reply,
            voteScore: reply.voteScore - transition.scoreDelta,
            upvoteCount: Math.max(0, (reply.upvoteCount ?? 0) - transition.upvoteDelta),
            downvoteCount: Math.max(0, (reply.downvoteCount ?? 0) - transition.downvoteDelta),
            viewerVote: previousVote,
          }
          : reply
      )))
      setActionError(getErrorMessage(err, 'Failed to register reply vote.'))
    } finally {
      setPendingReplyVoteId(null)
    }
  }

  async function handlePostReply() {
    if (!threadId || !replyDraft.trim()) return

    try {
      setPostingReply(true)
      const { reply } = await postReply({
        threadId,
        content: replyDraft.trim(),
        parentReplyId: replyingTo?.id,
      })
      appendReplyIfMissing(reply)
      setReplyDraft('')
      setReplyingTo(null)
    } finally {
      setPostingReply(false)
    }
  }

  async function handleToggleThreadStatus() {
    if (!threadId || !thread || !isThreadAuthor) return

    const nextStatus = thread.status === 'CLOSED' ? 'OPEN' : 'CLOSED'
    try {
      setUpdatingThreadStatus(true)
      await updateThreadStatus(threadId, nextStatus)
      setThread((prev) => (prev ? { ...prev, status: nextStatus } : prev))
    } finally {
      setUpdatingThreadStatus(false)
    }
  }

  function beginEditReply(reply: ThreadReply) {
    setEditingReplyId(reply.id)
    setEditingReplyDraft(reply.content)
  }

  function cancelEditReply() {
    setEditingReplyId(null)
    setEditingReplyDraft('')
  }

  async function handleSaveEditedReply(replyId: string) {
    if (!threadId || !editingReplyDraft.trim()) return

    try {
      setActionError(null)
      const nextContent = editingReplyDraft.trim()

      await editReply({
        threadId,
        replyId,
        content: nextContent,
      })

      setReplies((prev) => prev.map((reply) => (
        reply.id === replyId
          ? { ...reply, content: nextContent, status: 'EDITED' }
          : reply
      )))

      cancelEditReply()
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to save your edit.'))
    }
  }

  async function handleDeleteReply(replyId: string) {
    if (!threadId) return
    await deleteReply({ threadId, replyId })
    removeReplyIfPresent(replyId)
    if (replyingTo?.id === replyId) {
      setReplyingTo(null)
    }
  }

  function renderReplyNode(reply: ThreadReply, depth: number): JSX.Element {
    const children = repliesByParent.get(reply.id) ?? []

    return (
      <div key={reply.id} className="thread-reply-tree-node" style={{ '--reply-depth': depth } as CSSProperties}>
        <article className="thread-reply-item">
          <div className="thread-votes thread-votes--reply">
            <button
              onClick={() => void handleVoteReply(reply.id, 'UPVOTE')}
              aria-label="Upvote reply"
              disabled={pendingReplyVoteId === reply.id}
              className={reply.viewerVote === 'UPVOTE' ? 'thread-vote-btn--active-up' : ''}
            >
              <ArrowBigUp size={16} />
            </button>
            <span>{reply.upvoteCount ?? 0}</span>
            <button
              onClick={() => void handleVoteReply(reply.id, 'DOWNVOTE')}
              aria-label="Downvote reply"
              disabled={pendingReplyVoteId === reply.id}
              className={reply.viewerVote === 'DOWNVOTE' ? 'thread-vote-btn--active-down' : ''}
            >
              <ArrowBigDown size={16} />
            </button>
            <span>{reply.downvoteCount ?? 0}</span>
          </div>

          <div className="thread-reply-content">
            <div className="thread-meta-row">
              <span>{reply.authorName ?? reply.authorId.slice(0, 8)}</span>
              <span>{formatRelativeDate(reply.createdAt)}</span>
              {reply.status === 'EDITED' && <span>edited</span>}
              {reply.parentReplyId && <span>reply</span>}
            </div>

            {editingReplyId === reply.id ? (
              <div className="thread-reply-edit-wrap">
                <textarea
                  value={editingReplyDraft}
                  onChange={(e) => setEditingReplyDraft(e.target.value)}
                />
                <div className="thread-reply-edit-actions">
                  <button
                    className="threads-primary-btn"
                    onClick={() => void handleSaveEditedReply(reply.id)}
                    disabled={!editingReplyDraft.trim()}
                  >
                    Save
                  </button>
                  <button className="threads-secondary-btn" onClick={cancelEditReply}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p>{reply.content}</p>
                <div className="thread-reply-owner-actions">
                  {canReplyToThread && (
                    <button className="threads-secondary-btn" onClick={() => setReplyingTo(reply)}>
                      Reply
                    </button>
                  )}
                  {currentUserId === reply.authorId && (
                    <>
                      <button className="threads-secondary-btn" onClick={() => beginEditReply(reply)}>
                        Edit
                      </button>
                      <button className="threads-secondary-btn" onClick={() => void handleDeleteReply(reply.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </article>

        {children.length > 0 && (
          <div className="thread-reply-children">
            {children.map((child) => renderReplyNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <main className="thread-detail-page">
        <div className="thread-detail-page__state">Loading discussion…</div>
      </main>
    )
  }

  if (error || !thread) {
    return (
      <main className="thread-detail-page">
        <div className="thread-detail-page__state">
          <p>{error ?? 'Discussion not found'}</p>
          <button className="threads-secondary-btn" onClick={() => navigate('/threads')}>
            Back to Discussions
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="thread-detail-page">
      <header className="thread-detail-page__topbar">
        <button className="threads-secondary-btn" onClick={() => navigate('/threads')}>
          <ArrowLeft size={15} />
          Back to Discussions
        </button>
      </header>

      <section className="thread-detail-page__content">
        <article className="thread-detail__header">
          <div className="thread-votes">
            <button
              onClick={() => void handleVoteThread('UPVOTE')}
              aria-label="Upvote thread"
              className={thread.viewerVote === 'UPVOTE' ? 'thread-vote-btn--active-up' : ''}
            >
              <ArrowBigUp size={18} />
            </button>
            <span>{thread.upvoteCount ?? 0}</span>
            <button
              onClick={() => void handleVoteThread('DOWNVOTE')}
              aria-label="Downvote thread"
              className={thread.viewerVote === 'DOWNVOTE' ? 'thread-vote-btn--active-down' : ''}
            >
              <ArrowBigDown size={18} />
            </button>
            <span>{thread.downvoteCount ?? 0}</span>
          </div>

          <div className="thread-main" style={{ cursor: 'default' }}>
            <h3>{thread.title}</h3>
            {thread.description && <p>{thread.description}</p>}
            <div className="thread-meta-row">
              <span>By {threadAuthorLabel}</span>
              <span>{formatRelativeDate(thread.createdAt)}</span>
              <span>{thread.replyCount} comments</span>
              <span>Status: {thread.status.toLowerCase()}</span>
            </div>

            {isThreadAuthor && (
              <div className="thread-owner-actions">
                <button
                  className="threads-secondary-btn"
                  onClick={() => void handleToggleThreadStatus()}
                  disabled={updatingThreadStatus}
                >
                  {updatingThreadStatus
                    ? 'Updating…'
                    : thread.status === 'CLOSED'
                      ? 'Reopen Thread'
                      : 'Close Thread'}
                </button>
              </div>
            )}
          </div>
        </article>

        <section className="thread-reply-box">
          {actionError && <p className="status-banner status-banner--error">{actionError}</p>}
          {replyingTo && (
            <div className="thread-reply-target">
              Replying to {replyingTo.authorName ?? replyingTo.authorId.slice(0, 8)}
              <button className="threads-secondary-btn" onClick={() => setReplyingTo(null)}>
                Cancel
              </button>
            </div>
          )}
          <textarea
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            placeholder={canReplyToThread ? 'Share your thoughts...' : 'Thread is closed. Replies are disabled.'}
            disabled={!canReplyToThread}
          />
          <button
            className="threads-primary-btn"
            disabled={postingReply || !replyDraft.trim() || !canReplyToThread}
            onClick={() => void handlePostReply()}
          >
            <Send size={15} />
            {postingReply ? 'Posting…' : 'Post Comment'}
          </button>
        </section>

        <section className="thread-replies">
          <h4>Comments ({replies.length})</h4>

          {replies.length === 0 && (
            <div className="threads-empty" style={{ minHeight: '8rem' }}>
              <MessageCircle size={24} />
              <p>No comments yet. Start the conversation.</p>
            </div>
          )}

          {(repliesByParent.get(null) ?? []).map((reply) => renderReplyNode(reply, 0))}
        </section>
      </section>
    </main>
  )
}

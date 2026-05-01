import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	BookOpen,
	Briefcase,
	ChevronRight,
	MessageCircle,
	Plus,
	Search,
	X,
} from 'lucide-react'
import {
	createThread,
	createThreadsSocket,
	getThread,
	listThreads,
	type SimilarThread,
	type Thread,
	type ThreadPanel,
	type ThreadSortBy,
} from '../api/threads.api'
import { getAccessToken, getRoleFromAccessToken, type UserRole } from '../lib/auth'
import { PlatformTopNav } from '../components/PlatformTopNav'

const MIN_SIMILARITY_CHARS = 10

const PANEL_META: Record<ThreadPanel, { title: string; subtitle: string }> = {
	ACADEMIC: {
		title: 'Academic Discussions',
		subtitle: 'Ask doubts, discuss coursework, and learn together with students and professors.',
	},
	ALUMNI: {
		title: 'Career Advice Board',
		subtitle: 'Get career guidance from alumni and professors. Share opportunities and insights.',
	},
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

export function ThreadsPage() {
	const navigate = useNavigate()
	const token = getAccessToken()
	const role = (token ? getRoleFromAccessToken(token) : null) as UserRole | null

	const availablePanels = useMemo<ThreadPanel[]>(() => {
		if (role === 'ALUMNI') {
			return ['ALUMNI']
		}
		return ['ACADEMIC', 'ALUMNI']
	}, [role])

	const [activePanel, setActivePanel] = useState<ThreadPanel>(
		role === 'ALUMNI' ? 'ALUMNI' : 'ACADEMIC',
	)
	const [sortBy, setSortBy] = useState<ThreadSortBy>('newest')
	const [searchText, setSearchText] = useState('')

	const [threads, setThreads] = useState<Thread[]>([])
	const [totalThreads, setTotalThreads] = useState(0)
	const [threadsLoading, setThreadsLoading] = useState(false)
	const [threadsError, setThreadsError] = useState<string | null>(null)

	const [showCreateModal, setShowCreateModal] = useState(false)
	const [creating, setCreating] = useState(false)
	const [createTitle, setCreateTitle] = useState('')
	const [createDescription, setCreateDescription] = useState('')

	const [similarThreads, setSimilarThreads] = useState<SimilarThread[]>([])
	const [similarityLoading, setSimilarityLoading] = useState(false)
	const [postCreateSuggestions, setPostCreateSuggestions] = useState<SimilarThread[]>([])

	const [toast, setToast] = useState<string | null>(null)
	const socketRef = useRef<ReturnType<typeof createThreadsSocket> | null>(null)

	useEffect(() => {
		if (!token) {
			navigate('/login', { replace: true })
		}
	}, [token, navigate])

	useEffect(() => {
		if (role === 'ALUMNI' && activePanel === 'ACADEMIC') {
			setActivePanel('ALUMNI')
		}
	}, [role, activePanel])

	useEffect(() => {
		if (!token) return

		const socket = createThreadsSocket(token)
		socketRef.current = socket

		socket.on('threads:similarity-results', (payload: { results: SimilarThread[] }) => {
			setSimilarityLoading(false)
			setSimilarThreads(payload.results ?? [])
		})

		socket.on('threads:reply-posted', (payload: { threadId: string }) => {
			setThreads((prev) => prev.map((thread) => (
				thread.id === payload.threadId
					? { ...thread, replyCount: thread.replyCount + 1 }
					: thread
			)))
		})

		socket.on('threads:thread-voted', (payload: {
			threadId: string
			voteScore: number
			upvoteCount: number
			downvoteCount: number
		}) => {
			setThreads((prev) => prev.map((thread) => (
				thread.id === payload.threadId
					? {
						...thread,
						voteScore: payload.voteScore,
						upvoteCount: payload.upvoteCount,
						downvoteCount: payload.downvoteCount,
					}
					: thread
			)))
		})

		return () => {
			socket.disconnect()
			socketRef.current = null
		}
	}, [token])

	const fetchThreads = useCallback(async () => {
		try {
			setThreadsLoading(true)
			setThreadsError(null)
			const { threads: list, total } = await listThreads({
				panel: activePanel,
				sortBy,
				take: 50,
			})
			setThreads(list)
			setTotalThreads(total)
		} catch (error) {
			setThreadsError(error instanceof Error ? error.message : 'Failed to load discussions.')
		} finally {
			setThreadsLoading(false)
		}
	}, [activePanel, sortBy])

	useEffect(() => {
		if (!token) return
		void fetchThreads()
	}, [fetchThreads, token])

	useEffect(() => {
		if (!showCreateModal) {
			setSimilarThreads([])
			setSimilarityLoading(false)
			return
		}

		const queryText = `${createTitle} ${createDescription}`.trim()
		if (queryText.length < MIN_SIMILARITY_CHARS) {
			setSimilarThreads([])
			setSimilarityLoading(false)
			return
		}

		const socket = socketRef.current
		if (!socket || !socket.connected) return

		const timer = window.setTimeout(() => {
			setSimilarityLoading(true)
			socket.emit('threads:typing-similarity', {
				query: queryText,
				panel: activePanel,
			})
		}, 350)

		return () => {
			window.clearTimeout(timer)
		}
	}, [createTitle, createDescription, showCreateModal, activePanel])

	useEffect(() => {
		if (!toast) return
		const timer = window.setTimeout(() => setToast(null), 3200)
		return () => window.clearTimeout(timer)
	}, [toast])

	const filteredThreads = useMemo(() => {
		if (!searchText.trim()) return threads
		const query = searchText.trim().toLowerCase()
		return threads.filter((thread) => {
			const titleMatch = thread.title.toLowerCase().includes(query)
			const bodyMatch = thread.description?.toLowerCase().includes(query) ?? false
			return titleMatch || bodyMatch
		})
	}, [threads, searchText])

	const topSimilarityPct = useMemo(() => {
		if (!similarThreads.length) return 0
		return Math.round(similarThreads[0].similarityScore * 100)
	}, [similarThreads])

	const similarityQueryText = `${createTitle} ${createDescription}`.trim()
	const hasEnoughSimilarityInput = similarityQueryText.length >= MIN_SIMILARITY_CHARS
	const hasSimilarityResults = !similarityLoading && similarThreads.length > 0

	const similarityHeadline = similarityLoading
		? 'Checking for similar discussions…'
		: !hasEnoughSimilarityInput
			? `Start typing — similarity search begins after ${MIN_SIMILARITY_CHARS} characters.`
			: hasSimilarityResults
				? topSimilarityPct >= 50
					? `We found a very close match (${topSimilarityPct}%). You might be interested in these first:`
					: 'You might be interested in viewing these similar discussions:'
				: 'No close matches yet. You can still post this discussion.'

	const pinCreatedThreadToTop = useCallback(async (threadId: string) => {
		setThreads((prev) => {
			const idx = prev.findIndex((thread) => thread.id === threadId)
			if (idx === -1) return prev

			const created = prev[idx]
			const rest = prev.filter((thread) => thread.id !== threadId)
			return [created, ...rest]
		})

		const inCurrentList = threads.some((thread) => thread.id === threadId)
		if (!inCurrentList) {
			try {
				const { thread } = await getThread(threadId)
				setThreads((prev) => [thread, ...prev])
			} catch {
				// ignore if thread is not visible in current panel for this role
			}
		}
	}, [threads])

	async function handleCreateThread(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const title = createTitle.trim()
		const description = createDescription.trim()
		const suggestionsAtSubmit = [...similarThreads]

		if (!title) {
			setToast('Please add a title before posting.')
			return
		}

		try {
			setCreating(true)
			const { threadId } = await createThread({
				title,
				description: description || undefined,
				panel: activePanel,
			})

			setShowCreateModal(false)
			setCreateTitle('')
			setCreateDescription('')
			setSimilarThreads([])

			await fetchThreads()
			await pinCreatedThreadToTop(threadId)

			const filtered = suggestionsAtSubmit
				.filter((item) => item.threadId !== threadId)
				.slice(0, 3)
			setPostCreateSuggestions(filtered)

			setToast('Discussion posted successfully.')
		} catch (error) {
			setToast(error instanceof Error ? error.message : 'Unable to post discussion.')
		} finally {
			setCreating(false)
		}
	}

	function openSuggestedThread(suggestion: SimilarThread) {
		if (role === 'ALUMNI' && suggestion.panel === 'ACADEMIC') {
			setToast('That discussion is in the academic panel and is not available for alumni.')
			return
		}

		setShowCreateModal(false)
		navigate(`/threads/${suggestion.threadId}`)
	}

	const pageSubtitle = role === 'ALUMNI'
		? 'Join career-focused conversations with alumni and professors.'
		: 'Join conversations across academics and career guidance.'

	return (
		<main className="threads-page-shell">
			<PlatformTopNav />

			<div className="threads-page">
				<header className="threads-header">
					<div>
						<h1>Discussions</h1>
						<p>{pageSubtitle}</p>
					</div>
					<div className="threads-header__actions">
						<button className="threads-primary-btn" onClick={() => setShowCreateModal(true)}>
							<Plus size={16} />
							New Discussion
						</button>
					</div>
				</header>

				<section className="threads-tabs">
					{availablePanels.includes('ACADEMIC') && (
						<button
							className={`threads-tab ${activePanel === 'ACADEMIC' ? 'threads-tab--active' : ''}`}
							onClick={() => {
								setActivePanel('ACADEMIC')
								setPostCreateSuggestions([])
							}}
						>
							<BookOpen size={15} />
							Academic Discussions
						</button>
					)}
					<button
						className={`threads-tab ${activePanel === 'ALUMNI' ? 'threads-tab--active' : ''}`}
						onClick={() => {
							setActivePanel('ALUMNI')
							setPostCreateSuggestions([])
						}}
					>
						<Briefcase size={15} />
						Career Advice
					</button>
				</section>

				<section className="threads-panel-intro">
					<h2>{PANEL_META[activePanel].title}</h2>
					<p>{PANEL_META[activePanel].subtitle}</p>
				</section>

				<section className="threads-toolbar">
					<div className="threads-search">
						<Search size={16} />
						<input
							value={searchText}
							onChange={(e) => setSearchText(e.target.value)}
							placeholder="Search discussions..."
						/>
					</div>

					<select
						value={sortBy}
						onChange={(e) => setSortBy(e.target.value as ThreadSortBy)}
						className="threads-sort"
					>
						<option value="newest">Newest</option>
						<option value="mostReplies">Most replies</option>
						<option value="topVoted">Top voted</option>
					</select>
				</section>

				{threadsError && <p className="status-banner status-banner--error">{threadsError}</p>}

				{postCreateSuggestions.length > 0 && (
					<section className="threads-recommend-banner">
						<p><strong>You might be interested in these discussions:</strong></p>
						<div className="threads-recommend-list">
							{postCreateSuggestions.map((item) => (
								<button
									key={item.threadId}
									type="button"
									onClick={() => navigate(`/threads/${item.threadId}`)}
								>
									<span>{Math.round(item.similarityScore * 100)}%</span>
									{item.title}
								</button>
							))}
						</div>
					</section>
				)}

				<section className="threads-list-only">
					<div className="threads-list">
						<div className="threads-list__meta">
							{threadsLoading ? 'Loading discussions…' : `${filteredThreads.length} of ${totalThreads} discussions`}
						</div>

						{!threadsLoading && filteredThreads.length === 0 && (
							<div className="threads-empty">
								<MessageCircle size={28} />
								<p>No discussions found for this panel yet.</p>
							</div>
						)}

						{filteredThreads.map((thread) => (
							<article
								key={thread.id}
								className="thread-card"
							>
								<button className="thread-main" onClick={() => navigate(`/threads/${thread.id}`)}>
									<h3>{thread.title}</h3>
									{thread.description && <p>{thread.description}</p>}
									<div className="thread-meta-row">
										<span>By {thread.authorName ?? thread.authorId.slice(0, 8)}</span>
										<span>{formatRelativeDate(thread.createdAt)}</span>
										<span>{thread.replyCount} comments</span>
										<span>↑ {thread.upvoteCount ?? 0} • ↓ {thread.downvoteCount ?? 0}</span>
									</div>
								</button>

								<button
									type="button"
									className="thread-open-btn"
									onClick={() => navigate(`/threads/${thread.id}`)}
									aria-label="Open discussion"
								>
									<ChevronRight size={18} />
								</button>
							</article>
						))}
					</div>
				</section>
			</div>

			{showCreateModal && (
				<div className="threads-modal-backdrop" onClick={() => setShowCreateModal(false)}>
					<section className="threads-modal" onClick={(e) => e.stopPropagation()}>
						<header className="threads-modal__header">
							<div>
								<h3>Start a Discussion</h3>
								<p>
									{activePanel === 'ACADEMIC'
										? 'Ask a doubt or discuss academic topics.'
										: 'Share a career question for alumni and professors.'}
								</p>
							</div>
							<button onClick={() => setShowCreateModal(false)} aria-label="Close modal">
								<X size={18} />
							</button>
						</header>

						<form className="threads-modal__form" onSubmit={handleCreateThread}>
							<label>
								<span>Title</span>
								<input
									value={createTitle}
									onChange={(e) => setCreateTitle(e.target.value)}
									maxLength={255}
									placeholder="What is your question or topic?"
									required
								/>
							</label>

							<label>
								<span>Content</span>
								<textarea
									value={createDescription}
									onChange={(e) => setCreateDescription(e.target.value)}
									placeholder="Share more details..."
								/>
							</label>

							<section className="similarity-panel">
								<p className="similarity-panel__headline">{similarityHeadline}</p>

								<div className="similarity-panel__results" aria-live="polite">
									{hasSimilarityResults ? (
										<ul>
											{similarThreads.map((item) => (
												<li key={item.threadId}>
													<button type="button" onClick={() => openSuggestedThread(item)}>
														<strong>{Math.round(item.similarityScore * 100)}%</strong>
														<span>{item.title}</span>
														<em>{item.panel === 'ACADEMIC' ? 'Academic' : 'Career'} panel</em>
													</button>
												</li>
											))}
										</ul>
									) : (
										<p className="similarity-panel__empty">Similar discussions will appear here as you type.</p>
									)}
								</div>
							</section>

							<div className="threads-modal__actions">
								<button type="button" className="threads-secondary-btn" onClick={() => setShowCreateModal(false)}>
									Cancel
								</button>
								<button type="submit" className="threads-primary-btn" disabled={creating}>
									{creating ? 'Posting…' : 'Post Discussion'}
								</button>
							</div>
						</form>
					</section>
				</div>
			)}

			{toast && <div className="threads-toast">{toast}</div>}
		</main>
	)
}

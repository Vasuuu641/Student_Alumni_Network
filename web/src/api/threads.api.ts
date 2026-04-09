import axios from 'axios'
import { io, type Socket } from 'socket.io-client'
import { getAccessToken } from '../lib/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
const NORMALIZED_API_BASE = API_BASE_URL.replace(/\/$/, '')

const api = axios.create({
	baseURL: NORMALIZED_API_BASE,
})

api.interceptors.request.use((config) => {
	const token = getAccessToken()
	if (token) {
		config.headers = config.headers ?? {}
		config.headers.Authorization = `Bearer ${token}`
	}
	return config
})

export type ThreadPanel = 'ACADEMIC' | 'ALUMNI'
export type ThreadStatus = 'OPEN' | 'CLOSED' | 'PINNED'
export type VoteType = 'UPVOTE' | 'DOWNVOTE'
export type ThreadSortBy = 'newest' | 'mostReplies' | 'topVoted'
export type ReplySortBy = 'newest' | 'topVoted'

export interface Thread {
	id: string
	title: string
	description: string | null
	panel: ThreadPanel
	status: ThreadStatus
	authorId: string
	authorName?: string
	viewerVote?: VoteType | null
	upvoteCount?: number
	downvoteCount?: number
	replyCount: number
	lastReplyAt: string | null
	viewCount: number
	voteScore: number
	createdAt: string
	updatedAt: string
}

export interface ThreadReply {
	id: string
	threadId: string
	content: string
	authorId: string
	authorName?: string
	viewerVote?: VoteType | null
	upvoteCount?: number
	downvoteCount?: number
	status: 'ACTIVE' | 'EDITED' | 'DELETED'
	editedAt: string | null
	voteScore: number
	parentReplyId: string | null
	createdAt: string
	updatedAt: string
}

export interface SimilarThread {
	threadId: string
	title: string
	panel: ThreadPanel
	replyCount: number
	voteScore: number
	similarityScore: number
}

export async function listThreads(input: {
	panel: ThreadPanel
	sortBy?: ThreadSortBy
	skip?: number
	take?: number
}): Promise<{ threads: Thread[]; total: number }> {
	const { data } = await api.get<{ threads: Thread[]; total: number }>('/threads', {
		params: {
			panel: input.panel,
			sortBy: input.sortBy ?? 'newest',
			skip: input.skip ?? 0,
			take: input.take ?? 20,
		},
	})
	return data
}

export async function getThread(threadId: string): Promise<{ thread: Thread }> {
	const { data } = await api.get<{ thread: Thread }>(`/threads/${threadId}`)
	return data
}

export async function createThread(payload: {
	title: string
	description?: string
	panel: ThreadPanel
}): Promise<{ threadId: string }> {
	const { data } = await api.post<{ threadId: string }>('/threads', payload)
	return data
}

export async function voteThread(threadId: string, voteType: VoteType): Promise<{ success: boolean }> {
	const { data } = await api.post<{ success: boolean }>(`/threads/${threadId}/vote`, { voteType })
	return data
}

export async function updateThreadStatus(
	threadId: string,
	status: ThreadStatus,
): Promise<{ success: boolean }> {
	const { data } = await api.patch<{ success: boolean }>(`/threads/${threadId}/status`, { status })
	return data
}

export async function listReplies(input: {
	threadId: string
	skip?: number
	take?: number
	sortBy?: ReplySortBy
}): Promise<{ replies: ThreadReply[]; total: number }> {
	const { data } = await api.get<{ replies: ThreadReply[]; total: number }>(
		`/threads/${input.threadId}/replies`,
		{
			params: {
				skip: input.skip ?? 0,
				take: input.take ?? 50,
				sortBy: input.sortBy ?? 'newest',
			},
		},
	)

	return data
}

export async function postReply(payload: {
	threadId: string
	content: string
	parentReplyId?: string
}): Promise<{ reply: ThreadReply }> {
	const { data } = await api.post<{ reply: ThreadReply }>(`/threads/${payload.threadId}/replies`, {
		content: payload.content,
		parentReplyId: payload.parentReplyId,
	})

	return data
}

export async function editReply(input: {
	threadId: string
	replyId: string
	content: string
}): Promise<{ success: boolean }> {
	const { data } = await api.patch<{ success: boolean }>(
		`/threads/${input.threadId}/replies/${input.replyId}`,
		{ content: input.content },
	)
	return data
}

export async function deleteReply(input: {
	threadId: string
	replyId: string
}): Promise<{ success: boolean }> {
	const { data } = await api.patch<{ success: boolean }>(
		`/threads/${input.threadId}/replies/${input.replyId}/delete`,
	)
	return data
}

export async function voteReply(input: {
	threadId: string
	replyId: string
	voteType: VoteType
}): Promise<{ success: boolean }> {
	const { data } = await api.post<{ success: boolean }>(
		`/threads/${input.threadId}/replies/${input.replyId}/vote`,
		{ voteType: input.voteType },
	)
	return data
}

export function createThreadsSocket(token: string): Socket {
	return io(`${NORMALIZED_API_BASE}/threads`, {
		transports: ['websocket', 'polling'],
		timeout: 10_000,
		reconnection: true,
		reconnectionAttempts: Infinity,
		reconnectionDelay: 1_000,
		reconnectionDelayMax: 8_000,
		auth: { token },
	})
}

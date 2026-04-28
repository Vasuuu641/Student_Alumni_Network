import { requestJson, API_BASE_URL } from '../lib/api';
import type { UserRole } from './profile.api';
import { io, type Socket } from 'socket.io-client';

export type ThreadPanel = 'ACADEMIC' | 'ALUMNI';
export type ThreadStatus = 'OPEN' | 'CLOSED' | 'PINNED';
export type VoteType = 'UPVOTE' | 'DOWNVOTE';
export type ReplySortBy = 'newest' | 'topVoted';

export interface ThreadSummary {
  id: string;
  title: string;
  description?: string | null;
  panel: ThreadPanel;
  updatedAt: string;
  replyCount: number;
  authorId?: string | null;
  authorName?: string | null;
}

export interface Thread extends ThreadSummary {
  status: ThreadStatus;
  createdAt: string;
  viewerVote?: VoteType | null;
  upvoteCount?: number;
  downvoteCount?: number;
  voteScore: number;
  lastReplyAt: string | null;
  viewCount: number;
  authorId: string;
}

export interface ThreadReply {
  id: string;
  threadId: string;
  content: string;
  authorId: string;
  authorName?: string;
  viewerVote?: VoteType | null;
  upvoteCount?: number;
  downvoteCount?: number;
  status: 'ACTIVE' | 'EDITED' | 'DELETED';
  editedAt: string | null;
  voteScore: number;
  parentReplyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListThreadsResponse {
  threads: ThreadSummary[];
  total: number;
}

export interface ListRepliesResponse {
  replies: ThreadReply[];
  total: number;
}

export async function listThreads(
  token: string,
  options: {
    panel: ThreadPanel;
    take?: number;
    skip?: number;
    sortBy?: 'newest' | 'oldest';
    role?: UserRole;
  },
): Promise<ListThreadsResponse> {
  const params = new URLSearchParams();
  params.set('panel', options.panel);
  params.set('take', String(options.take ?? 20));
  params.set('skip', String(options.skip ?? 0));
  params.set('sortBy', options.sortBy ?? 'newest');

  return requestJson<ListThreadsResponse>(`/threads?${params.toString()}`, { token });
}

export async function createThread(
  token: string,
  payload: {
    title: string;
    description?: string;
    panel: ThreadPanel;
  },
): Promise<{ threadId: string }> {
  return requestJson<{ threadId: string }>('/threads', { token, body: payload, method: 'POST' });
}

export async function getThread(
  token: string,
  threadId: string
): Promise<{ thread: Thread }> {
  return requestJson<{ thread: Thread }>(`/threads/${threadId}`, { token });
}

export async function listReplies(
  token: string,
  input: {
    threadId: string;
    skip?: number;
    take?: number;
    sortBy?: ReplySortBy;
  }
): Promise<ListRepliesResponse> {
  const params = new URLSearchParams();
  params.set('skip', String(input.skip ?? 0));
  params.set('take', String(input.take ?? 50));
  params.set('sortBy', input.sortBy ?? 'newest');

  return requestJson<ListRepliesResponse>(
    `/threads/${input.threadId}/replies?${params.toString()}`,
    { token }
  );
}

export async function postReply(
  token: string,
  payload: {
    threadId: string;
    content: string;
    parentReplyId?: string;
  }
): Promise<{ reply: ThreadReply }> {
  return requestJson<{ reply: ThreadReply }>(`/threads/${payload.threadId}/replies`, {
    token,
    body: {
      content: payload.content,
      parentReplyId: payload.parentReplyId,
    },
    method: 'POST',
  });
}

export async function voteThread(
  token: string,
  threadId: string,
  voteType: VoteType
): Promise<{ success: boolean }> {
  return requestJson<{ success: boolean }>(`/threads/${threadId}/vote`, {
    token,
    body: { voteType },
    method: 'POST',
  });
}

export async function voteReply(
  token: string,
  threadId: string,
  replyId: string,
  voteType: VoteType
): Promise<{ success: boolean }> {
  return requestJson<{ success: boolean }>(`/threads/${threadId}/replies/${replyId}/vote`, {
    token,
    body: { voteType },
    method: 'POST',
  });
}

export async function editReply(
  token: string,
  threadId: string,
  replyId: string,
  content: string
): Promise<{ success: boolean }> {
  return requestJson<{ success: boolean }>(`/threads/${threadId}/replies/${replyId}`, {
    token,
    body: { content },
    method: 'PATCH',
  });
}

export async function deleteReply(
  token: string,
  threadId: string,
  replyId: string
): Promise<{ success: boolean }> {
  return requestJson<{ success: boolean }>(`/threads/${threadId}/replies/${replyId}`, {
    token,
    method: 'DELETE',
  });
}

export function createThreadsSocket(token: string): Socket {
  const base = API_BASE_URL.replace(/\/$/, '');
  return io(`${base}/threads`, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    auth: { token },
  });
}
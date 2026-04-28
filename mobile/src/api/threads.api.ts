import { requestJson, API_BASE_URL } from '../lib/api';
import type { UserRole } from './profile.api';
import { io, type Socket } from 'socket.io-client';

export type ThreadPanel = 'ACADEMIC' | 'ALUMNI';

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

export interface ListThreadsResponse {
  threads: ThreadSummary[];
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
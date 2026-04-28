import { requestJson } from '../lib/api';
import type { UserRole } from './profile.api';

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
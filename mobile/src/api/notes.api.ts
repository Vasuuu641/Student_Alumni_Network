import { requestJson } from '../lib/api';

export interface NoteSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export async function listUserNotes(token: string): Promise<NoteSummary[]> {
  const response = await requestJson<{ notes: NoteSummary[] }>('/notes', { token });
  return response.notes ?? [];
}
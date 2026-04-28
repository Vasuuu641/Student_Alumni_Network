import { requestJson } from '../lib/api';

export interface StudyGroupSummary {
  id: string;
  name: string;
  status: string;
}

export async function listStudyGroups(token: string): Promise<StudyGroupSummary[]> {
  return requestJson<StudyGroupSummary[]>('/study-groups', { token });
}
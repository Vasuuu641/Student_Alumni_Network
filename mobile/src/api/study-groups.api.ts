import { requestJson } from '../lib/api';

export type StudyGroupVisibility = 'PUBLIC' | 'PRIVATE';
export type StudyGroupStatus = 'ACTIVE' | 'ARCHIVE' | 'DELETED';
export type StudyGroupMemberRole = 'OWNER' | 'MODERATOR' | 'MEMBER';
export type StudyGroupJoinStatus = 'ACTIVE' | 'LEFT' | 'REMOVED' | 'PENDING';
export type StudyGroupPostStatus = 'ACTIVE' | 'EDITED' | 'DELETED';

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  visibility: StudyGroupVisibility;
  status: StudyGroupStatus;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudyGroupSummary {
  id: string;
  name: string;
  status: string;
}

export interface StudyGroupMember {
  userId: string;
  role: StudyGroupMemberRole;
  joinStatus: StudyGroupJoinStatus;
}

export interface StudyGroupPost {
  id: string;
  authorId: string;
  content: string;
  status: StudyGroupPostStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendedStudyGroup {
  id: string;
  name: string;
  description: string;
  visibility: StudyGroupVisibility;
  score: number;
  matchingSignals: string[];
}

type RawStudyGroup = Omit<StudyGroup, 'visibility' | 'status'> & {
  visibility: StudyGroupVisibility | string | number;
  status: StudyGroupStatus | string | number;
};

type RawStudyGroupMember = Omit<StudyGroupMember, 'role' | 'joinStatus'> & {
  role: StudyGroupMemberRole | string | number;
  joinStatus: StudyGroupJoinStatus | string | number;
};

type RawStudyGroupPost = Omit<StudyGroupPost, 'status'> & {
  status: StudyGroupPostStatus | string | number;
};

type RawRecommendedStudyGroup = Omit<RecommendedStudyGroup, 'visibility'> & {
  visibility: StudyGroupVisibility | string | number;
};

function normalizeVisibility(value: StudyGroupVisibility | string | number): StudyGroupVisibility {
  if (value === 'PUBLIC' || value === 'public' || value === 0 || value === '0') {
    return 'PUBLIC';
  }
  if (value === 'PRIVATE' || value === 'private' || value === 1 || value === '1') {
    return 'PRIVATE';
  }
  return 'PUBLIC';
}

function normalizeStatus(value: StudyGroupStatus | string | number): StudyGroupStatus {
  if (value === 'ACTIVE' || value === 'active' || value === 0 || value === '0') {
    return 'ACTIVE';
  }
  if (value === 'ARCHIVE' || value === 'archive' || value === 1 || value === '1') {
    return 'ARCHIVE';
  }
  if (value === 'DELETED' || value === 'deleted' || value === 2 || value === '2') {
    return 'DELETED';
  }
  return 'ACTIVE';
}

function normalizeMemberRole(value: StudyGroupMemberRole | string | number): StudyGroupMemberRole {
  if (value === 'OWNER' || value === 'owner' || value === 0 || value === '0') {
    return 'OWNER';
  }
  if (value === 'MODERATOR' || value === 'moderator' || value === 1 || value === '1') {
    return 'MODERATOR';
  }
  if (value === 'MEMBER' || value === 'member' || value === 2 || value === '2') {
    return 'MEMBER';
  }
  return 'MEMBER';
}

function normalizeJoinStatus(value: StudyGroupJoinStatus | string | number): StudyGroupJoinStatus {
  if (value === 'ACTIVE' || value === 'active' || value === 0 || value === '0') {
    return 'ACTIVE';
  }
  if (value === 'LEFT' || value === 'left' || value === 1 || value === '1') {
    return 'LEFT';
  }
  if (value === 'REMOVED' || value === 'removed' || value === 2 || value === '2') {
    return 'REMOVED';
  }
  if (value === 'PENDING' || value === 'pending' || value === 3 || value === '3') {
    return 'PENDING';
  }
  return 'ACTIVE';
}

function normalizePostStatus(value: StudyGroupPostStatus | string | number): StudyGroupPostStatus {
  if (value === 'ACTIVE' || value === 'active' || value === 0 || value === '0') {
    return 'ACTIVE';
  }
  if (value === 'EDITED' || value === 'edited' || value === 1 || value === '1') {
    return 'EDITED';
  }
  if (value === 'DELETED' || value === 'deleted' || value === 2 || value === '2') {
    return 'DELETED';
  }
  return 'ACTIVE';
}

function toStudyGroup(raw: RawStudyGroup): StudyGroup {
  return {
    ...raw,
    visibility: normalizeVisibility(raw.visibility),
    status: normalizeStatus(raw.status),
  };
}

function toStudyGroupMember(raw: RawStudyGroupMember): StudyGroupMember {
  return {
    ...raw,
    role: normalizeMemberRole(raw.role),
    joinStatus: normalizeJoinStatus(raw.joinStatus),
  };
}

function toStudyGroupPost(raw: RawStudyGroupPost): StudyGroupPost {
  return {
    ...raw,
    status: normalizePostStatus(raw.status),
  };
}

function toRecommendedStudyGroup(raw: RawRecommendedStudyGroup): RecommendedStudyGroup {
  return {
    ...raw,
    visibility: normalizeVisibility(raw.visibility),
    score: Number.isFinite(raw.score) ? raw.score : 0,
    matchingSignals: Array.isArray(raw.matchingSignals) ? raw.matchingSignals : [],
  };
}

export async function listStudyGroups(
  token: string,
  input?: { visibility?: StudyGroupVisibility; ownerId?: string },
): Promise<StudyGroup[]> {
  let url = '/study-groups';
  if (input) {
    const params = new URLSearchParams();
    if (input.visibility) params.set('visibility', input.visibility);
    if (input.ownerId) params.set('ownerId', input.ownerId);
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
  }
  const data = await requestJson<RawStudyGroup[]>(url, { token });
  return data.map(toStudyGroup);
}

export async function getStudyGroup(token: string, groupId: string): Promise<StudyGroup> {
  const data = await requestJson<RawStudyGroup>(`/study-groups/${groupId}`, { token });
  return toStudyGroup(data);
}

export async function createStudyGroup(
  token: string,
  payload: {
    name: string;
    description: string;
    visibility: StudyGroupVisibility;
    initialMemberIds: string[];
    maxMembers?: number | null;
  },
): Promise<StudyGroup> {
  const data = await requestJson<RawStudyGroup>('/study-groups', {
    token,
    method: 'POST',
    body: payload,
  });
  return toStudyGroup(data);
}

export async function addStudyGroupMember(
  token: string,
  groupId: string,
  payload: { userId: string; role?: StudyGroupMemberRole },
): Promise<void> {
  await requestJson<void>(`/study-groups/${groupId}/members`, {
    token,
    method: 'POST',
    body: payload,
  });
}

export async function updateStudyGroup(
  token: string,
  groupId: string,
  payload: { name?: string; description?: string },
): Promise<StudyGroup> {
  const data = await requestJson<RawStudyGroup>(`/study-groups/${groupId}`, {
    token,
    method: 'PATCH',
    body: payload,
  });
  return toStudyGroup(data);
}

export async function archiveStudyGroup(token: string, groupId: string): Promise<void> {
  await requestJson<void>(`/study-groups/${groupId}/archive`, {
    token,
    method: 'PATCH',
    body: {},
  });
}

export async function unarchiveStudyGroup(token: string, groupId: string): Promise<void> {
  await requestJson<void>(`/study-groups/${groupId}/archive`, {
    token,
    method: 'DELETE',
  });
}

export async function deleteStudyGroup(token: string, groupId: string): Promise<StudyGroup> {
  const data = await requestJson<RawStudyGroup>(`/study-groups/${groupId}/delete`, {
    token,
    method: 'PATCH',
    body: {},
  });
  return toStudyGroup(data);
}

export async function joinStudyGroup(token: string, groupId: string): Promise<void> {
  await requestJson<void>(`/study-groups/${groupId}/join`, {
    token,
    method: 'POST',
    body: {},
  });
}

export async function leaveStudyGroup(token: string, groupId: string): Promise<void> {
  await requestJson<void>(`/study-groups/${groupId}/leave`, {
    token,
    method: 'POST',
    body: {},
  });
}

export async function listStudyGroupMembers(token: string, groupId: string): Promise<StudyGroupMember[]> {
  const data = await requestJson<RawStudyGroupMember[]>(`/study-groups/${groupId}/members`, {
    token,
  });
  return data.map(toStudyGroupMember);
}

export async function listStudyGroupPosts(token: string, groupId: string): Promise<StudyGroupPost[]> {
  const data = await requestJson<RawStudyGroupPost[]>(`/study-groups/${groupId}/posts`, {
    token,
  });
  return data.map(toStudyGroupPost);
}

export async function createStudyGroupPost(token: string, groupId: string, content: string): Promise<StudyGroupPost> {
  const data = await requestJson<RawStudyGroupPost>(`/study-groups/${groupId}/posts`, {
    token,
    method: 'POST',
    body: { content },
  });
  return toStudyGroupPost(data);
}

export async function listRecommendedStudyGroups(token: string, limit = 3): Promise<RecommendedStudyGroup[]> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  const data = await requestJson<RawRecommendedStudyGroup[]>(`/study-groups/recommendations/me?${params.toString()}`, {
    token,
  });
  return data.map(toRecommendedStudyGroup);
}

export async function listArchivedStudyGroups(token: string): Promise<StudyGroup[]> {
  const data = await requestJson<RawStudyGroup[]>('/study-groups/me/archived', { token });
  return data.map(toStudyGroup);
}
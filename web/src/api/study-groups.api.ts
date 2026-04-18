import { api } from './http-client';

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

export async function listStudyGroups(input?: {
  visibility?: StudyGroupVisibility;
  ownerId?: string;
}): Promise<StudyGroup[]> {
  const { data } = await api.get<RawStudyGroup[]>('/study-groups', {
    params: input,
  });

  return data.map(toStudyGroup);
}

export async function getStudyGroup(groupId: string): Promise<StudyGroup> {
  const { data } = await api.get<RawStudyGroup>(`/study-groups/${groupId}`);
  return toStudyGroup(data);
}

export async function createStudyGroup(payload: {
  name: string;
  description: string;
  visibility: StudyGroupVisibility;
  initialMemberIds: string[];
  maxMembers?: number | null;
}): Promise<StudyGroup> {
  const { data } = await api.post<RawStudyGroup>('/study-groups', payload);
  return toStudyGroup(data);
}

export async function addStudyGroupMember(
  groupId: string,
  payload: { userId: string; role?: StudyGroupMemberRole },
): Promise<void> {
  await api.post(`/study-groups/${groupId}/members`, payload);
}

export async function updateStudyGroup(groupId: string, payload: { name?: string; description?: string }): Promise<StudyGroup> {
  const { data } = await api.patch<RawStudyGroup>(`/study-groups/${groupId}`, payload);
  return toStudyGroup(data);
}

export async function archiveStudyGroup(groupId: string): Promise<void> {
  await api.patch(`/study-groups/${groupId}/archive`, {});
}

export async function unarchiveStudyGroup(groupId: string): Promise<void> {
  await api.delete(`/study-groups/${groupId}/archive`);
}

export async function deleteStudyGroup(groupId: string): Promise<StudyGroup> {
  const { data } = await api.patch<RawStudyGroup>(`/study-groups/${groupId}/delete`, {});
  return toStudyGroup(data);
}

export async function joinStudyGroup(groupId: string): Promise<void> {
  await api.post(`/study-groups/${groupId}/join`, {});
}

export async function leaveStudyGroup(groupId: string): Promise<void> {
  await api.post(`/study-groups/${groupId}/leave`, {});
}

export async function listStudyGroupMembers(groupId: string): Promise<StudyGroupMember[]> {
  const { data } = await api.get<RawStudyGroupMember[]>(`/study-groups/${groupId}/members`);
  return data.map(toStudyGroupMember);
}

export async function listStudyGroupPosts(groupId: string): Promise<StudyGroupPost[]> {
  const { data } = await api.get<RawStudyGroupPost[]>(`/study-groups/${groupId}/posts`);
  return data.map(toStudyGroupPost);
}

export async function createStudyGroupPost(groupId: string, content: string): Promise<StudyGroupPost> {
  const { data } = await api.post<RawStudyGroupPost>(`/study-groups/${groupId}/posts`, { content });
  return toStudyGroupPost(data);
}

export async function listRecommendedStudyGroups(limit = 3): Promise<RecommendedStudyGroup[]> {
  const { data } = await api.get<RawRecommendedStudyGroup[]>('/study-groups/recommendations/me', {
    params: { limit },
  });

  return data.map(toRecommendedStudyGroup);
}

export async function listArchivedStudyGroups(): Promise<StudyGroup[]> {
  const { data } = await api.get<RawStudyGroup[]>('/study-groups/me/archived');
  return data.map(toStudyGroup);
}

import axios from 'axios';
import { getAccessToken } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

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

export async function listStudyGroups(input?: {
  visibility?: StudyGroupVisibility;
  ownerId?: string;
}): Promise<StudyGroup[]> {
  const { data } = await api.get<StudyGroup[]>('/study-groups', {
    params: input,
  });

  return data;
}

export async function getStudyGroup(groupId: string): Promise<StudyGroup> {
  const { data } = await api.get<StudyGroup>(`/study-groups/${groupId}`);
  return data;
}

export async function createStudyGroup(payload: {
  name: string;
  description: string;
  visibility: StudyGroupVisibility;
  maxMembers?: number | null;
}): Promise<StudyGroup> {
  const { data } = await api.post<StudyGroup>('/study-groups', payload);
  return data;
}

export async function updateStudyGroup(groupId: string, payload: { name?: string; description?: string }): Promise<StudyGroup> {
  const { data } = await api.patch<StudyGroup>(`/study-groups/${groupId}`, payload);
  return data;
}

export async function archiveStudyGroup(groupId: string): Promise<StudyGroup> {
  const { data } = await api.patch<StudyGroup>(`/study-groups/${groupId}/archive`, {});
  return data;
}

export async function joinStudyGroup(groupId: string): Promise<void> {
  await api.post(`/study-groups/${groupId}/join`, {});
}

export async function leaveStudyGroup(groupId: string): Promise<void> {
  await api.post(`/study-groups/${groupId}/leave`, {});
}

export async function listStudyGroupMembers(groupId: string): Promise<StudyGroupMember[]> {
  const { data } = await api.get<StudyGroupMember[]>(`/study-groups/${groupId}/members`);
  return data;
}

export async function listStudyGroupPosts(groupId: string): Promise<StudyGroupPost[]> {
  const { data } = await api.get<StudyGroupPost[]>(`/study-groups/${groupId}/posts`);
  return data;
}

export async function createStudyGroupPost(groupId: string, content: string): Promise<StudyGroupPost> {
  const { data } = await api.post<StudyGroupPost>(`/study-groups/${groupId}/posts`, { content });
  return data;
}

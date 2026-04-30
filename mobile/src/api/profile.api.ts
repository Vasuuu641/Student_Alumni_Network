import { requestJson } from '../lib/api';

export type UserRole = 'STUDENT' | 'PROFESSOR' | 'ALUMNI' | 'ADMIN';

export interface UserProfileData {
  userId: string;
  firstName: string;
  lastName: string;
  major?: string | null;
  yearOfGraduation?: number | null;
  yearofGraduation?: number | null;
  jobTitle?: string | null;
  company?: string | null;
  faculty?: string | null;
  bio?: string | null;
  interests?: string[];
  profilePictureUrl?: string | null;
  isAnonymous?: boolean;
  anonymousName?: string | null;
}

export interface CurrentUserProfile {
  role: UserRole;
  profile: UserProfileData;
}

export interface AdminProfileData {
  userId: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN';
}

export async function loadCurrentUserProfile(token: string): Promise<CurrentUserProfile> {
  const candidates: Array<{ role: UserRole; path: string }> = [
    { role: 'ADMIN', path: '/auth/me' },
    { role: 'STUDENT', path: '/students/profile' },
    { role: 'PROFESSOR', path: '/professors/profile' },
    { role: 'ALUMNI', path: '/alumni/profile' },
  ];

  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const profile = await requestJson<UserProfileData>(candidate.path, { token });
      return {
        role: candidate.role,
        profile: normalizeProfile(profile),
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error('Unable to load profile.');
}

export async function loadAdminProfile(token: string): Promise<AdminProfileData> {
  const profile = await requestJson<AdminProfileData>('/auth/me', { token });
  return profile;
}

export async function updateAdminProfile(
  token: string,
  payload: { firstName?: string; lastName?: string },
): Promise<AdminProfileData> {
  const profile = await requestJson<AdminProfileData>('/auth/me', {
    token,
    method: 'PUT',
    body: payload,
  });
  return profile;
}

function normalizeProfile(profile: UserProfileData): UserProfileData {
  const graduationYear = profile.yearOfGraduation ?? profile.yearofGraduation ?? null;

  return {
    ...profile,
    yearOfGraduation: graduationYear,
    yearofGraduation: graduationYear,
    interests: profile.interests ?? [],
  };
}
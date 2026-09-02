import { requestJson } from '../lib/api';

export type UserRole = 'STUDENT' | 'PROFESSOR' | 'ALUMNI' | 'ADMIN';

export interface OnboardingProfileResponse {
  firstName?: string | null;
  lastName?: string | null;
  major?: string | null;
  yearOfGraduation?: number | null;
  yearofGraduation?: number | null;
  company?: string | null;
  jobTitle?: string | null;
  faculty?: string | null;
  bio?: string | null;
  interests?: string[] | null;
  isAnonymous?: boolean | null;
  anonymousName?: string | null;
}

export interface UpdateOnboardingRequest {
  token: string;
  role: Exclude<UserRole, 'ADMIN'>;
  payload: Record<string, unknown>;
  profilePicture?: { uri: string; name: string; type: string };
}

const pathByRole: Record<Exclude<UserRole, 'ADMIN'>, string> = {
  STUDENT: '/students/profile',
  ALUMNI: '/alumni/profile',
  PROFESSOR: '/professors/profile',
};

export async function getOnboardingProfile(
  token: string,
  role: Exclude<UserRole, 'ADMIN'>,
): Promise<OnboardingProfileResponse> {
  const profile = await requestJson<OnboardingProfileResponse>(pathByRole[role], { token });
  return profile ?? {};
}

export async function updateOnboardingProfile({
  token,
  role,
  payload,
  profilePicture,
}: UpdateOnboardingRequest): Promise<void> {
  if (Object.keys(payload).length > 0) {
    await requestJson(pathByRole[role], {
      token,
      method: 'PUT',
      body: payload,
    });
  }

  if (profilePicture) {
    const formData = new FormData();
    formData.append('profilePicture', {
      uri: profilePicture.uri,
      name: profilePicture.name,
      type: profilePicture.type,
    } as any);

    await requestJson(pathByRole[role], {
      token,
      method: 'PUT',
      body: formData,
    });
  }
}

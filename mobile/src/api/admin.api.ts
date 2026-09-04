import { requestJson } from '../lib/api';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export type AuthorizedRole = 'STUDENT' | 'ALUMNI' | 'PROFESSOR' | 'ADMIN';
export type GeoReviewStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type GeoSection = 'OFFICIAL_RESOURCE' | 'COMMUNITY_PICK';
export type GeoCategory =
  | 'UNIVERSITY_SERVICE'
  | 'ACADEMIC_DEPARTMENT'
  | 'ADMIN_OFFICE'
  | 'STUDENT_SUPPORT'
  | 'CAMPUS_FACILITY'
  | 'RESTAURANT'
  | 'CAFE'
  | 'STUDY_SPOT'
  | 'SOCIAL_HANGOUT'
  | 'FITNESS_WELLNESS'
  | 'SHOPPING'
  | 'OTHER';

export interface AuthorizedUser {
  id: string;
  email: string;
  role: AuthorizedRole;
  isUsed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeoSpotForReview {
  id: string;
  title: string;
  description: string | null;
  city: string;
  address: string | null;
  latitude: number;
  longitude: number;
  section: GeoSection;
  category: GeoCategory;
  createdById: string;
  isActive: boolean;
  reviewStatus: GeoReviewStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  visitCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminThread {
  id: string;
  title: string;
  description: string | null;
  panel: 'ACADEMIC' | 'ALUMNI';
  status: 'OPEN' | 'CLOSED' | 'PINNED';
  authorId: string;
  authorName?: string;
  replyCount: number;
  voteScore: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function listAuthorizedUsers(token: string): Promise<AuthorizedUser[]> {
  try {
    const data = await requestJson<AuthorizedUser[]>('/admin/users/authorized', { token });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to load authorized users.'));
  }
}

export async function createAuthorizedUser(
  token: string,
  payload: {
    email: string;
    role: AuthorizedRole;
  },
): Promise<AuthorizedUser> {
  try {
    const data = await requestJson<AuthorizedUser>('/admin/users/authorized', {
      token,
      method: 'POST',
      body: payload,
    });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to register authorized user.'));
  }
}

export async function updateAuthorizedUser(
  token: string,
  id: string,
  payload: { email?: string; role?: AuthorizedRole },
): Promise<AuthorizedUser> {
  try {
    const data = await requestJson<AuthorizedUser>(`/admin/users/authorized/${id}`, {
      token,
      method: 'PUT',
      body: payload,
    });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to update authorized user.'));
  }
}

export async function deleteAuthorizedUser(
  token: string,
  id: string,
): Promise<{ message: string }> {
  try {
    const data = await requestJson<{ message: string }>(`/admin/users/authorized/${id}`, {
      token,
      method: 'DELETE',
    });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to delete authorized user.'));
  }
}

export async function listGeoReviewQueue(
  token: string,
  params?: {
    city?: string;
    section?: GeoSection;
    category?: GeoCategory;
    reviewStatus?: GeoReviewStatus;
    isActive?: boolean;
    limit?: number;
    page?: number;
  },
): Promise<GeoSpotForReview[]> {
  try {
    const queryString = params
      ? '?' +
        Object.entries(params)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
          .join('&')
      : '';

    const data = await requestJson<GeoSpotForReview[]>(
      `/geo-help-board/spots/review-queue${queryString}`,
      { token },
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to load geo moderation queue.'));
  }
}

export async function reviewGeoSpot(
  token: string,
  spotId: string,
  isVerified: boolean,
): Promise<GeoSpotForReview> {
  try {
    const data = await requestJson<GeoSpotForReview>(
      `/geo-help-board/spots/${spotId}/review`,
      {
        token,
        method: 'PATCH',
        body: { isVerified },
      },
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to review geo spot request.'));
  }
}

export async function deactivateGeoSpot(
  token: string,
  spotId: string,
): Promise<GeoSpotForReview> {
  try {
    const data = await requestJson<GeoSpotForReview>(
      `/geo-help-board/spots/${spotId}/deactivate`,
      {
        token,
        method: 'PATCH',
      },
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to delete geo spot.'));
  }
}

export async function listThreadsForAdmin(
  token: string,
  input: {
    panel: 'ACADEMIC' | 'ALUMNI';
    sortBy?: 'newest' | 'mostReplies' | 'topVoted';
    skip?: number;
    take?: number;
  },
): Promise<{ threads: AdminThread[]; total: number }> {
  try {
    const normalizedTake = Math.min(Math.max(input.take ?? 50, 1), 50);

    const query = new URLSearchParams({
      panel: input.panel,
      sortBy: input.sortBy ?? 'newest',
      skip: String(input.skip ?? 0),
      take: String(normalizedTake),
    });

    const data = await requestJson<{ threads: AdminThread[]; total: number }>(`/threads?${query.toString()}`, {
      token,
    });

    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to load threads for moderation.'));
  }
}

export async function setThreadStatus(
  token: string,
  threadId: string,
  status: 'OPEN' | 'CLOSED' | 'PINNED',
): Promise<{ success: boolean }> {
  try {
    const data = await requestJson<{ success: boolean }>(`/threads/${threadId}/status`, {
      token,
      method: 'PATCH',
      body: { status },
    });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to update thread status.'));
  }
}

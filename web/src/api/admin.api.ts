import { api } from './http-client';

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
  ) {
    const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
    if (Array.isArray(message) && message.length > 0) return message.join(', ');
    if (typeof message === 'string' && message.trim()) return message;
  }

  if (error instanceof Error && error.message) return error.message;
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

export async function listAuthorizedUsers(): Promise<AuthorizedUser[]> {
  try {
    const { data } = await api.get<AuthorizedUser[]>('/admin/users/authorized');
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to load authorized users.'));
  }
}

export async function createAuthorizedUser(payload: {
  email: string;
  role: AuthorizedRole;
}): Promise<AuthorizedUser> {
  try {
    const { data } = await api.post<AuthorizedUser>('/admin/users/authorized', payload);
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to register authorized user.'));
  }
}

export async function updateAuthorizedUser(
  id: string,
  payload: { email?: string; role?: AuthorizedRole },
): Promise<AuthorizedUser> {
  try {
    const { data } = await api.put<AuthorizedUser>(`/admin/users/authorized/${id}`, payload);
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to update authorized user.'));
  }
}

export async function deleteAuthorizedUser(id: string): Promise<{ message: string }> {
  try {
    const { data } = await api.delete<{ message: string }>(`/admin/users/authorized/${id}`);
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to delete authorized user.'));
  }
}

export async function listGeoReviewQueue(params?: {
  city?: string;
  section?: GeoSection;
  category?: GeoCategory;
  reviewStatus?: GeoReviewStatus;
  isActive?: boolean;
  limit?: number;
  page?: number;
}): Promise<GeoSpotForReview[]> {
  try {
    const { data } = await api.get<GeoSpotForReview[]>('/geo-help-board/spots/review-queue', {
      params,
    });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to load geo moderation queue.'));
  }
}

export async function reviewGeoSpot(spotId: string, isVerified: boolean): Promise<GeoSpotForReview> {
  try {
    const { data } = await api.patch<GeoSpotForReview>(`/geo-help-board/spots/${spotId}/review`, {
      isVerified,
    });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to review geo spot request.'));
  }
}

export async function deactivateGeoSpot(spotId: string): Promise<GeoSpotForReview> {
  try {
    const { data } = await api.patch<GeoSpotForReview>(`/geo-help-board/spots/${spotId}/deactivate`);
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to delete geo spot.'));
  }
}

export async function listThreadsForAdmin(input: {
  panel: 'ACADEMIC' | 'ALUMNI';
  sortBy?: 'newest' | 'mostReplies' | 'topVoted';
  skip?: number;
  take?: number;
}): Promise<{ threads: AdminThread[]; total: number }> {
  try {
    const normalizedTake = Math.min(Math.max(input.take ?? 50, 1), 50);
    const { data } = await api.get<{ threads: AdminThread[]; total: number }>('/threads', {
      params: {
        panel: input.panel,
        sortBy: input.sortBy ?? 'newest',
        skip: input.skip ?? 0,
        take: normalizedTake,
      },
    });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to load threads for moderation.'));
  }
}

export async function setThreadStatus(
  threadId: string,
  status: 'OPEN' | 'CLOSED' | 'PINNED',
): Promise<{ success: boolean }> {
  try {
    const { data } = await api.patch<{ success: boolean }>(`/threads/${threadId}/status`, { status });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to update thread status.'));
  }
}

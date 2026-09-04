import axios from 'axios';
import { getAccessToken } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const NORMALIZED_API_BASE = API_BASE_URL.replace(/\/$/, '');

const api = axios.create({
  baseURL: NORMALIZED_API_BASE,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export type GeoHelpSpotCategory =
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

export type GeoHelpSpotSection = 'OFFICIAL_RESOURCE' | 'COMMUNITY_PICK';

export type GeoHelpSpotReviewStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface GeoHelpSpot {
  id: string;
  title: string;
  description: string | null;
  city: string;
  address: string | null;
  latitude: number;
  longitude: number;
  section: GeoHelpSpotSection;
  category: GeoHelpSpotCategory;
  createdById: string;
  isActive: boolean;
  reviewStatus: GeoHelpSpotReviewStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  visitCount: number;
  createdAt: string;
  updatedAt: string;
  distanceKm?: number;
}

type RawGeoHelpSpot = Omit<GeoHelpSpot, 'section' | 'category' | 'reviewStatus'> & {
  section: GeoHelpSpotSection | string;
  category: GeoHelpSpotCategory | string | number;
  reviewStatus: GeoHelpSpotReviewStatus | string | number;
  latitude: number | string;
  longitude: number | string;
  visitCount: number | string;
  distanceKm?: number | string;
};

const CATEGORY_VALUES: GeoHelpSpotCategory[] = [
  'UNIVERSITY_SERVICE',
  'ACADEMIC_DEPARTMENT',
  'ADMIN_OFFICE',
  'STUDENT_SUPPORT',
  'CAMPUS_FACILITY',
  'RESTAURANT',
  'CAFE',
  'STUDY_SPOT',
  'SOCIAL_HANGOUT',
  'FITNESS_WELLNESS',
  'SHOPPING',
  'OTHER',
];

const SECTION_VALUES: GeoHelpSpotSection[] = ['OFFICIAL_RESOURCE', 'COMMUNITY_PICK'];

const REVIEW_STATUS_VALUES: GeoHelpSpotReviewStatus[] = ['PENDING', 'VERIFIED', 'REJECTED'];

function normalizeCategory(value: GeoHelpSpotCategory | string | number): GeoHelpSpotCategory {
  if (typeof value === 'number') {
    return CATEGORY_VALUES[value] ?? 'OTHER';
  }

  const normalized = String(value).toUpperCase();
  if (CATEGORY_VALUES.includes(normalized as GeoHelpSpotCategory)) {
    return normalized as GeoHelpSpotCategory;
  }

  return 'OTHER';
}

function normalizeSection(value: GeoHelpSpotSection | string): GeoHelpSpotSection {
  const normalized = String(value).toUpperCase();
  if (SECTION_VALUES.includes(normalized as GeoHelpSpotSection)) {
    return normalized as GeoHelpSpotSection;
  }

  return 'COMMUNITY_PICK';
}

function normalizeReviewStatus(value: GeoHelpSpotReviewStatus | string | number): GeoHelpSpotReviewStatus {
  if (typeof value === 'number') {
    return REVIEW_STATUS_VALUES[value] ?? 'PENDING';
  }

  const normalized = String(value).toUpperCase();
  if (REVIEW_STATUS_VALUES.includes(normalized as GeoHelpSpotReviewStatus)) {
    return normalized as GeoHelpSpotReviewStatus;
  }

  return 'PENDING';
}

function toGeoHelpSpot(raw: RawGeoHelpSpot): GeoHelpSpot {
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  const visitCount = Number(raw.visitCount);
  const distanceKm = raw.distanceKm === undefined ? undefined : Number(raw.distanceKm);

  return {
    ...raw,
    latitude: Number.isFinite(latitude) ? latitude : 0,
    longitude: Number.isFinite(longitude) ? longitude : 0,
    visitCount: Number.isFinite(visitCount) ? visitCount : 0,
    section: normalizeSection(raw.section),
    category: normalizeCategory(raw.category),
    reviewStatus: normalizeReviewStatus(raw.reviewStatus),
    distanceKm: Number.isFinite(distanceKm) ? distanceKm : undefined,
  };
}

function toApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'isAxiosError' in error) {
    const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }

    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return error instanceof Error ? error.message : fallback;
}

export async function listNearbyGeoHelpSpots(input: {
  latitude: number;
  longitude: number;
  radiusKm: number;
  city?: string;
  section?: GeoHelpSpotSection;
  category?: GeoHelpSpotCategory;
  limit?: number;
  page?: number;
}): Promise<GeoHelpSpot[]> {
  try {
    const { data } = await api.get<RawGeoHelpSpot[]>('/geo-help-board/spots/nearby', {
      params: {
        latitude: input.latitude,
        longitude: input.longitude,
        radiusKm: input.radiusKm,
        city: input.city,
        section: input.section,
        category: input.category,
        limit: input.limit ?? 30,
        page: input.page ?? 1,
      },
    });

    return data.map(toGeoHelpSpot);
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Failed to load nearby campus resources.'));
  }
}

export async function listPopularGeoHelpSpots(input: {
  city?: string;
  section?: GeoHelpSpotSection;
  category?: GeoHelpSpotCategory;
  limit?: number;
  page?: number;
}): Promise<GeoHelpSpot[]> {
  try {
    const { data } = await api.get<RawGeoHelpSpot[]>('/geo-help-board/spots/popular', {
      params: {
        city: input.city,
        section: input.section,
        category: input.category,
        limit: input.limit ?? 30,
        page: input.page ?? 1,
      },
    });

    return data.map(toGeoHelpSpot);
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Failed to load popular campus resources.'));
  }
}

export async function recordGeoHelpSpotVisit(spotId: string): Promise<void> {
  try {
    await api.post(`/geo-help-board/spots/${spotId}/visit`);
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Failed to record the visit.'));
  }
}

export async function createGeoHelpSpot(payload: {
  title: string;
  description?: string;
  city: string;
  address?: string;
  latitude: number;
  longitude: number;
  section: GeoHelpSpotSection;
  category: GeoHelpSpotCategory;
}): Promise<GeoHelpSpot> {
  try {
    const { data } = await api.post<RawGeoHelpSpot>('/geo-help-board/spots', payload);
    return toGeoHelpSpot(data);
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Failed to create the location.'));
  }
}

export async function deactivateGeoHelpSpot(spotId: string): Promise<GeoHelpSpot> {
  try {
    const { data } = await api.patch<RawGeoHelpSpot>(`/geo-help-board/spots/${spotId}/deactivate`);
    return toGeoHelpSpot(data);
  } catch (error) {
    throw new Error(toApiErrorMessage(error, 'Failed to delete the location.'));
  }
}

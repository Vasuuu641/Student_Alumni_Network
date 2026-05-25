import { requestJson } from '../lib/api';

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

function toQueryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return;
    }
    query.set(key, String(value));
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export async function listNearbyGeoHelpSpots(
  token: string,
  input: {
    latitude: number;
    longitude: number;
    radiusKm: number;
    city?: string;
    section?: GeoHelpSpotSection;
    category?: GeoHelpSpotCategory;
    limit?: number;
    page?: number;
  },
): Promise<GeoHelpSpot[]> {
  const path = `/geo-help-board/spots/nearby${toQueryString({
    latitude: input.latitude,
    longitude: input.longitude,
    radiusKm: input.radiusKm,
    city: input.city,
    section: input.section,
    category: input.category,
    limit: input.limit ?? 30,
    page: input.page ?? 1,
  })}`;

  const data = await requestJson<RawGeoHelpSpot[]>(path, { token });
  return data.map(toGeoHelpSpot);
}

export async function listPopularGeoHelpSpots(
  token: string,
  input: {
    city?: string;
    section?: GeoHelpSpotSection;
    category?: GeoHelpSpotCategory;
    limit?: number;
    page?: number;
  },
): Promise<GeoHelpSpot[]> {
  const path = `/geo-help-board/spots/popular${toQueryString({
    city: input.city,
    section: input.section,
    category: input.category,
    limit: input.limit ?? 30,
    page: input.page ?? 1,
  })}`;

  const data = await requestJson<RawGeoHelpSpot[]>(path, { token });
  return data.map(toGeoHelpSpot);
}

export async function recordGeoHelpSpotVisit(token: string, spotId: string): Promise<void> {
  await requestJson<void>(`/geo-help-board/spots/${spotId}/visit`, {
    token,
    method: 'POST',
    body: {},
  });
}

export async function createGeoHelpSpot(
  token: string,
  payload: {
    title: string;
    description?: string;
    city: string;
    address?: string;
    latitude: number;
    longitude: number;
    section: GeoHelpSpotSection;
    category: GeoHelpSpotCategory;
  },
): Promise<GeoHelpSpot> {
  const data = await requestJson<RawGeoHelpSpot>('/geo-help-board/spots', {
    token,
    method: 'POST',
    body: payload,
  });
  return toGeoHelpSpot(data);
}

export async function deactivateGeoHelpSpot(token: string, spotId: string): Promise<GeoHelpSpot> {
  const data = await requestJson<RawGeoHelpSpot>(`/geo-help-board/spots/${spotId}/deactivate`, {
    token,
    method: 'PATCH',
  });
  return toGeoHelpSpot(data);
}

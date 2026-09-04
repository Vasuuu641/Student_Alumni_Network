export enum GeoHelpSpotCategory {
  UNIVERSITY_SERVICE = 'UNIVERSITY_SERVICE',
  ACADEMIC_DEPARTMENT = 'ACADEMIC_DEPARTMENT',
  ADMIN_OFFICE = 'ADMIN_OFFICE',
  STUDENT_SUPPORT = 'STUDENT_SUPPORT',
  CAMPUS_FACILITY = 'CAMPUS_FACILITY',
  RESTAURANT = 'RESTAURANT',
  CAFE = 'CAFE',
  STUDY_SPOT = 'STUDY_SPOT',
  SOCIAL_HANGOUT = 'SOCIAL_HANGOUT',
  FITNESS_WELLNESS = 'FITNESS_WELLNESS',
  SHOPPING = 'SHOPPING',
  OTHER = 'OTHER',
}

export enum GeoHelpSpotSection {
  OFFICIAL_RESOURCE = 'OFFICIAL_RESOURCE',
  COMMUNITY_PICK = 'COMMUNITY_PICK',
}

export enum GeoHelpSpotReviewStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export class GeoHelpSpot {
  constructor(
    public readonly id: string,
    public title: string,
    public description: string | null,
    public city: string,
    public address: string | null,
    public latitude: number,
    public longitude: number,
    public section: GeoHelpSpotSection,
    public category: GeoHelpSpotCategory,
    public readonly createdById: string,
    public isActive: boolean,
    public reviewStatus: GeoHelpSpotReviewStatus,
    public reviewedById: string | null,
    public reviewedAt: Date | null,
    public visitCount: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}

export interface GeoHelpSpotWithDistance extends GeoHelpSpot {
  distanceKm: number;
}

export class GeoHelpSpotVisit {
  constructor(
    public readonly id: string,
    public readonly spotId: string,
    public readonly userId: string,
    public readonly visitedAt: Date,
  ) {}
}

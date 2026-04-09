export enum GeoHelpSpotCategory {
  STUDY_SPACE = 'STUDY_SPACE',
  FOOD = 'FOOD',
  TRANSPORT = 'TRANSPORT',
  HOUSING = 'HOUSING',
  HEALTH = 'HEALTH',
  GYM = 'GYM',
  LIBRARY = 'LIBRARY',
  OTHER = 'OTHER',
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

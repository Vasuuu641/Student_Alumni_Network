import { GeoHelpSpot, GeoHelpSpotCategory, GeoHelpSpotVisit, GeoHelpSpotWithDistance } from '../entities/geo-help-spot.entity';

export interface CreateGeoHelpSpotInput {
  title: string;
  description?: string | null;
  city: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  category: GeoHelpSpotCategory;
  createdById: string;
}

export interface ListGeoHelpSpotsFilter {
  city?: string;
  category?: GeoHelpSpotCategory;
  isActive?: boolean;
  limit?: number;
}

export interface GeoHelpBoardRepository {
  createSpot(input: CreateGeoHelpSpotInput): Promise<GeoHelpSpot>;
  findSpotById(spotId: string): Promise<GeoHelpSpot | null>;
  listPopularSpots(filter: ListGeoHelpSpotsFilter): Promise<GeoHelpSpot[]>;
  listNearbySpots(params: {
    latitude: number;
    longitude: number;
    radiusKm: number;
    city?: string;
    category?: GeoHelpSpotCategory;
    limit?: number;
  }): Promise<GeoHelpSpotWithDistance[]>;
  recordVisit(spotId: string, userId: string): Promise<GeoHelpSpotVisit>;
}

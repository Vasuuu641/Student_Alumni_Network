import { Inject, Injectable } from '@nestjs/common';
import { GeoHelpSpotCategory, GeoHelpSpotWithDistance } from '../../domain/entities/geo-help-spot.entity';
import type { GeoHelpBoardRepository } from '../../domain/repositories/geo-help-board.repository';
import { GeoHelpBoardValidationError } from './geo-help-board.errors';

export interface ListNearbyGeoHelpSpotsRequest {
  latitude: number;
  longitude: number;
  radiusKm: number;
  city?: string;
  category?: GeoHelpSpotCategory;
  limit?: number;
  page?: number;
}

@Injectable()
export class ListNearbyGeoHelpSpotsUseCase {
  private static readonly MIN_RADIUS_KM = 0.1;
  private static readonly MAX_RADIUS_KM = 50;
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    @Inject('GeoHelpBoardRepository')
    private readonly geoHelpBoardRepository: GeoHelpBoardRepository,
  ) {}

  async execute(request: ListNearbyGeoHelpSpotsRequest): Promise<GeoHelpSpotWithDistance[]> {
    if (!Number.isFinite(request.latitude) || !Number.isFinite(request.longitude) || !Number.isFinite(request.radiusKm)) {
      throw new GeoHelpBoardValidationError('Latitude, longitude and radius must be valid numbers');
    }

    if (request.latitude < -90 || request.latitude > 90) {
      throw new GeoHelpBoardValidationError('Latitude must be between -90 and 90');
    }

    if (request.longitude < -180 || request.longitude > 180) {
      throw new GeoHelpBoardValidationError('Longitude must be between -180 and 180');
    }

    if (
      request.radiusKm < ListNearbyGeoHelpSpotsUseCase.MIN_RADIUS_KM ||
      request.radiusKm > ListNearbyGeoHelpSpotsUseCase.MAX_RADIUS_KM
    ) {
      throw new GeoHelpBoardValidationError(
        `Radius must be between ${ListNearbyGeoHelpSpotsUseCase.MIN_RADIUS_KM} and ${ListNearbyGeoHelpSpotsUseCase.MAX_RADIUS_KM} km`,
      );
    }

    const limit = this.normalizeLimit(request.limit);
    const page = this.normalizePage(request.page);

    return this.geoHelpBoardRepository.listNearbySpots({
      latitude: request.latitude,
      longitude: request.longitude,
      radiusKm: request.radiusKm,
      city: request.city?.trim(),
      category: request.category,
      limit,
      offset: (page - 1) * limit,
    });
  }

  private normalizeLimit(limit?: number): number {
    if (!Number.isFinite(limit)) {
      return ListNearbyGeoHelpSpotsUseCase.DEFAULT_LIMIT;
    }

    const normalized = Math.trunc(limit as number);
    if (normalized < 1) {
      return 1;
    }

    return Math.min(normalized, ListNearbyGeoHelpSpotsUseCase.MAX_LIMIT);
  }

  private normalizePage(page?: number): number {
    if (!Number.isFinite(page)) {
      return 1;
    }

    const normalized = Math.trunc(page as number);
    return normalized < 1 ? 1 : normalized;
  }
}

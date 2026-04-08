import { Inject, Injectable } from '@nestjs/common';
import { GeoHelpSpotCategory, GeoHelpSpotWithDistance } from '../../domain/entities/geo-help-spot.entity';
import type { GeoHelpBoardRepository } from '../../domain/repositories/geo-help-board.repository';

export interface ListNearbyGeoHelpSpotsRequest {
  latitude: number;
  longitude: number;
  radiusKm: number;
  city?: string;
  category?: GeoHelpSpotCategory;
  limit?: number;
}

@Injectable()
export class ListNearbyGeoHelpSpotsUseCase {
  constructor(
    @Inject('GeoHelpBoardRepository')
    private readonly geoHelpBoardRepository: GeoHelpBoardRepository,
  ) {}

  async execute(request: ListNearbyGeoHelpSpotsRequest): Promise<GeoHelpSpotWithDistance[]> {
    if (request.latitude < -90 || request.latitude > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }

    if (request.longitude < -180 || request.longitude > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }

    if (request.radiusKm <= 0) {
      throw new Error('Radius must be greater than 0');
    }

    return this.geoHelpBoardRepository.listNearbySpots({
      latitude: request.latitude,
      longitude: request.longitude,
      radiusKm: request.radiusKm,
      city: request.city?.trim(),
      category: request.category,
      limit: request.limit,
    });
  }
}

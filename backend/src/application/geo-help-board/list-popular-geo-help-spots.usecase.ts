import { Inject, Injectable } from '@nestjs/common';
import { GeoHelpSpot, GeoHelpSpotCategory } from '../../domain/entities/geo-help-spot.entity';
import type { GeoHelpBoardRepository } from '../../domain/repositories/geo-help-board.repository';

export interface ListPopularGeoHelpSpotsRequest {
  city?: string;
  category?: GeoHelpSpotCategory;
  limit?: number;
}

@Injectable()
export class ListPopularGeoHelpSpotsUseCase {
  constructor(
    @Inject('GeoHelpBoardRepository')
    private readonly geoHelpBoardRepository: GeoHelpBoardRepository,
  ) {}

  async execute(request: ListPopularGeoHelpSpotsRequest): Promise<GeoHelpSpot[]> {
    return this.geoHelpBoardRepository.listPopularSpots({
      city: request.city?.trim(),
      category: request.category,
      isActive: true,
      limit: request.limit,
    });
  }
}

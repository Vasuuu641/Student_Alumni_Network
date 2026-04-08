import { Inject, Injectable } from '@nestjs/common';
import { GeoHelpSpot, GeoHelpSpotCategory } from '../../domain/entities/geo-help-spot.entity';
import type { GeoHelpBoardRepository } from '../../domain/repositories/geo-help-board.repository';

export interface CreateGeoHelpSpotRequest {
  title: string;
  description?: string | null;
  city: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  category?: GeoHelpSpotCategory;
  createdById: string;
}

@Injectable()
export class CreateGeoHelpSpotUseCase {
  constructor(
    @Inject('GeoHelpBoardRepository')
    private readonly geoHelpBoardRepository: GeoHelpBoardRepository,
  ) {}

  async execute(request: CreateGeoHelpSpotRequest): Promise<GeoHelpSpot> {
    if (request.latitude < -90 || request.latitude > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }

    if (request.longitude < -180 || request.longitude > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }

    return this.geoHelpBoardRepository.createSpot({
      title: request.title.trim(),
      description: request.description?.trim() || null,
      city: request.city.trim(),
      address: request.address?.trim() || null,
      latitude: request.latitude,
      longitude: request.longitude,
      category: request.category ?? GeoHelpSpotCategory.OTHER,
      createdById: request.createdById,
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { GeoHelpSpot, GeoHelpSpotCategory } from '../../domain/entities/geo-help-spot.entity';
import type { GeoHelpBoardRepository } from '../../domain/repositories/geo-help-board.repository';
import { GeoHelpBoardForbiddenError, GeoHelpBoardNotFoundError, GeoHelpBoardValidationError } from './geo-help-board.errors';

export interface EditGeoHelpSpotRequest {
  spotId: string;
  requesterId: string;
  requesterRole: string;
  title?: string;
  description?: string | null;
  city?: string;
  address?: string | null;
  latitude?: number;
  longitude?: number;
  category?: GeoHelpSpotCategory;
}

@Injectable()
export class EditGeoHelpSpotUseCase {
  constructor(
    @Inject('GeoHelpBoardRepository')
    private readonly geoHelpBoardRepository: GeoHelpBoardRepository,
  ) {}

  async execute(request: EditGeoHelpSpotRequest): Promise<GeoHelpSpot> {
    const spot = await this.geoHelpBoardRepository.findSpotById(request.spotId);
    if (!spot || !spot.isActive) {
      throw new GeoHelpBoardNotFoundError('Spot not found');
    }

    if (request.requesterId !== spot.createdById && request.requesterRole !== 'PROFESSOR' && request.requesterRole !== 'ADMIN') {
      throw new GeoHelpBoardForbiddenError('You are not allowed to edit this spot');
    }

    if (request.latitude !== undefined && (request.latitude < -90 || request.latitude > 90)) {
      throw new GeoHelpBoardValidationError('Latitude must be between -90 and 90');
    }

    if (request.longitude !== undefined && (request.longitude < -180 || request.longitude > 180)) {
      throw new GeoHelpBoardValidationError('Longitude must be between -180 and 180');
    }

    return this.geoHelpBoardRepository.updateSpot({
      spotId: request.spotId,
      title: request.title?.trim(),
      description: request.description === undefined ? undefined : request.description?.trim() || null,
      city: request.city?.trim(),
      address: request.address === undefined ? undefined : request.address?.trim() || null,
      latitude: request.latitude,
      longitude: request.longitude,
      category: request.category,
    });
  }
}

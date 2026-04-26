import { Inject, Injectable } from '@nestjs/common';
import { GeoHelpSpot } from '../../domain/entities/geo-help-spot.entity';
import type { GeoHelpBoardRepository } from '../../domain/repositories/geo-help-board.repository';
import { GeoHelpBoardForbiddenError, GeoHelpBoardNotFoundError } from './geo-help-board.errors';

export interface DeactivateGeoHelpSpotRequest {
  spotId: string;
  requesterId: string;
  requesterRole: string;
}

@Injectable()
export class DeactivateGeoHelpSpotUseCase {
  constructor(
    @Inject('GeoHelpBoardRepository')
    private readonly geoHelpBoardRepository: GeoHelpBoardRepository,
  ) {}

  async execute(request: DeactivateGeoHelpSpotRequest): Promise<GeoHelpSpot> {
    const spot = await this.geoHelpBoardRepository.findSpotById(request.spotId);
    if (!spot || !spot.isActive) {
      throw new GeoHelpBoardNotFoundError('Spot not found');
    }

    const isAdmin = request.requesterRole === 'ADMIN';
    const isStudent = request.requesterRole === 'STUDENT';
    const isOwner = request.requesterId === spot.createdById;

    if (!isAdmin && !isStudent && !isOwner) {
      throw new GeoHelpBoardForbiddenError('You are not allowed to deactivate this spot');
    }

    return this.geoHelpBoardRepository.deactivateSpot(request.spotId);
  }
}

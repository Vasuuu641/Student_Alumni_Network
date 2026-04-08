import { Inject, Injectable } from '@nestjs/common';
import { GeoHelpSpot, GeoHelpSpotReviewStatus } from '../../domain/entities/geo-help-spot.entity';
import type { GeoHelpBoardRepository } from '../../domain/repositories/geo-help-board.repository';
import { GeoHelpBoardNotFoundError } from './geo-help-board.errors';

export interface VerifyGeoHelpSpotRequest {
  spotId: string;
  isVerified: boolean;
}

@Injectable()
export class VerifyGeoHelpSpotUseCase {
  constructor(
    @Inject('GeoHelpBoardRepository')
    private readonly geoHelpBoardRepository: GeoHelpBoardRepository,
  ) {}

  async execute(request: VerifyGeoHelpSpotRequest): Promise<GeoHelpSpot> {
    const spot = await this.geoHelpBoardRepository.findSpotById(request.spotId);
    if (!spot) {
      throw new GeoHelpBoardNotFoundError('Spot not found');
    }

    return this.geoHelpBoardRepository.reviewSpot({
      spotId: request.spotId,
      reviewStatus: request.isVerified ? GeoHelpSpotReviewStatus.VERIFIED : GeoHelpSpotReviewStatus.REJECTED,
    });
  }
}

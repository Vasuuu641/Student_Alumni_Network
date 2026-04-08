import { Inject, Injectable } from '@nestjs/common';
import { GeoHelpSpotVisit } from '../../domain/entities/geo-help-spot.entity';
import type { GeoHelpBoardRepository } from '../../domain/repositories/geo-help-board.repository';

export interface RecordGeoHelpSpotVisitRequest {
  spotId: string;
  userId: string;
}

@Injectable()
export class RecordGeoHelpSpotVisitUseCase {
  constructor(
    @Inject('GeoHelpBoardRepository')
    private readonly geoHelpBoardRepository: GeoHelpBoardRepository,
  ) {}

  async execute(request: RecordGeoHelpSpotVisitRequest): Promise<GeoHelpSpotVisit> {
    const spot = await this.geoHelpBoardRepository.findSpotById(request.spotId);
    if (!spot || !spot.isActive) {
      throw new Error('Spot not found');
    }

    return this.geoHelpBoardRepository.recordVisit(request.spotId, request.userId);
  }
}

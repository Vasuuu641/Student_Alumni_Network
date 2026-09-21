import { Inject, Injectable } from '@nestjs/common';
import { GeoHelpSpotVisit } from '../../domain/entities/geo-help-spot.entity';
import type { GeoHelpBoardRepository } from '../../domain/repositories/geo-help-board.repository';
import { GeoHelpBoardNotFoundError } from './geo-help-board.errors';
import { NotificationEligibilityService } from 'src/infrastructure/services/notification-eligibility.service';
import { InterestSignalType } from 'src/domain/entities/user-interest.entity';

export interface RecordGeoHelpSpotVisitRequest {
  spotId: string;
  userId: string;
}

@Injectable()
export class RecordGeoHelpSpotVisitUseCase {
  constructor(
    @Inject('GeoHelpBoardRepository')
    private readonly geoHelpBoardRepository: GeoHelpBoardRepository,
    private readonly eligibilityService: NotificationEligibilityService,
  ) {}

  async execute(request: RecordGeoHelpSpotVisitRequest): Promise<GeoHelpSpotVisit> {
    const spot = await this.geoHelpBoardRepository.findSpotById(request.spotId);
    if (!spot || !spot.isActive) {
      throw new GeoHelpBoardNotFoundError('Spot not found');
    }

    const visit = await this.geoHelpBoardRepository.recordVisit(request.spotId, request.userId);

    this.eligibilityService
      .captureSignal(
        request.userId,
        InterestSignalType.GEO_VISIT,
        'GEO_HELP_SPOT',
        request.spotId,
        undefined, // geo events have no ThreadPanel-style sourcePanel
        'geo-help-board',
      )
      .catch((error) => {
        console.error(`Failed to capture geo visit signal: ${error?.message ?? error}`);
      });

    return visit;
  }
}
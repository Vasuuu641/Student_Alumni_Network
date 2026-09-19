// src/application/geo-help-board/save-geo-help-spot.usecase.ts
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { GeoHelpBoardRepository } from '../../domain/repositories/geo-help-board.repository';
import type { SavedItemRepository } from 'src/domain/repositories/saved-item.repository';
import { SavedItem } from 'src/domain/entities/saved-item.entity';
import { GeoHelpBoardNotFoundError } from './geo-help-board.errors';
import { NotificationEligibilityService } from 'src/infrastructure/services/notification-eligibility.service';
import { InterestSignalType } from 'src/domain/entities/user-interest.entity';

@Injectable()
export class SaveGeoHelpSpotUseCase {
  constructor(
    @Inject('GeoHelpBoardRepository')
    private readonly geoHelpBoardRepository: GeoHelpBoardRepository,
    @Inject('SavedItemRepository')
    private readonly savedItemRepository: SavedItemRepository,
    private readonly eligibilityService: NotificationEligibilityService,
  ) {}

  async execute(spotId: string, userId: string): Promise<SavedItem> {
    const spot = await this.geoHelpBoardRepository.findSpotById(spotId);
    if (!spot || !spot.isActive) {
      throw new GeoHelpBoardNotFoundError('Spot not found');
    }

    const saved = await this.savedItemRepository.save(
      new SavedItem(randomUUID(), userId, 'GEO_HELP_SPOT', spotId, new Date()),
    );

    this.eligibilityService
      .captureSignal(userId, InterestSignalType.GEO_SAVE, 'GEO_HELP_SPOT', spotId, undefined, 'geo-help-board')
      .catch((error) => {
        console.error(`Failed to capture geo save signal: ${error?.message ?? error}`);
      });

    return saved;
  }
}
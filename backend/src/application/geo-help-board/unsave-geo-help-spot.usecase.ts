// src/application/geo-help-board/unsave-geo-help-spot.usecase.ts
import { Inject, Injectable } from '@nestjs/common';
import type { SavedItemRepository } from 'src/domain/repositories/saved-item.repository';

@Injectable()
export class UnsaveGeoHelpSpotUseCase {
  constructor(
    @Inject('SavedItemRepository') private readonly savedItemRepository: SavedItemRepository,
  ) {}

  async execute(spotId: string, userId: string): Promise<void> {
    await this.savedItemRepository.unsave(userId, 'GEO_HELP_SPOT', spotId);
  }
}
// src/application/geo-help-board/list-saved-geo-help-spots.usecase.ts
import { Inject, Injectable } from '@nestjs/common';
import { GeoHelpSpot } from '../../domain/entities/geo-help-spot.entity';
import type { GeoHelpBoardRepository } from '../../domain/repositories/geo-help-board.repository';
import type { SavedItemRepository } from 'src/domain/repositories/saved-item.repository';

@Injectable()
export class ListSavedGeoHelpSpotsUseCase {
  constructor(
    @Inject('SavedItemRepository') private readonly savedItemRepository: SavedItemRepository,
    @Inject('GeoHelpBoardRepository')
    private readonly geoHelpBoardRepository: GeoHelpBoardRepository,
  ) {}

  async execute(userId: string): Promise<GeoHelpSpot[]> {
    const savedItems = await this.savedItemRepository.findByUserId(userId, 'GEO_HELP_SPOT');

    const spots = await Promise.all(
      savedItems.map((item) => this.geoHelpBoardRepository.findSpotById(item.entityId)),
    );

    return spots.filter((spot): spot is GeoHelpSpot => spot !== null && spot.isActive);
  }
}
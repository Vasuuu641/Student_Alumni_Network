import { Inject, Injectable } from '@nestjs/common';
import { GeoHelpSpot, GeoHelpSpotCategory, GeoHelpSpotReviewStatus } from '../../domain/entities/geo-help-spot.entity';
import type { GeoHelpBoardRepository } from '../../domain/repositories/geo-help-board.repository';

export interface ListReviewGeoHelpSpotsRequest {
  city?: string;
  category?: GeoHelpSpotCategory;
  reviewStatus?: GeoHelpSpotReviewStatus;
  isActive?: boolean;
  limit?: number;
  page?: number;
}

@Injectable()
export class ListReviewGeoHelpSpotsUseCase {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    @Inject('GeoHelpBoardRepository')
    private readonly geoHelpBoardRepository: GeoHelpBoardRepository,
  ) {}

  async execute(request: ListReviewGeoHelpSpotsRequest): Promise<GeoHelpSpot[]> {
    const limit = this.normalizeLimit(request.limit);
    const page = this.normalizePage(request.page);

    return this.geoHelpBoardRepository.listSpotsForAdmin({
      city: request.city?.trim(),
      category: request.category,
      reviewStatus: request.reviewStatus,
      isActive: request.isActive,
      limit,
      offset: (page - 1) * limit,
    });
  }

  private normalizeLimit(limit?: number): number {
    if (!Number.isFinite(limit)) {
      return ListReviewGeoHelpSpotsUseCase.DEFAULT_LIMIT;
    }

    const normalized = Math.trunc(limit as number);
    if (normalized < 1) {
      return 1;
    }

    return Math.min(normalized, ListReviewGeoHelpSpotsUseCase.MAX_LIMIT);
  }

  private normalizePage(page?: number): number {
    if (!Number.isFinite(page)) {
      return 1;
    }

    const normalized = Math.trunc(page as number);
    return normalized < 1 ? 1 : normalized;
  }
}

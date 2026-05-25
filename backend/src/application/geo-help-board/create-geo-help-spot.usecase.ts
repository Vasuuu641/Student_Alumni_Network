import { Inject, Injectable } from '@nestjs/common';
import { GeoHelpSpot, GeoHelpSpotCategory, GeoHelpSpotSection } from '../../domain/entities/geo-help-spot.entity';
import type { GeoHelpBoardRepository } from '../../domain/repositories/geo-help-board.repository';
import { GeoHelpBoardConflictError, GeoHelpBoardValidationError } from './geo-help-board.errors';
import { NotificationType } from 'src/domain/entities/notification.entity';
import { PersonalizedNotificationFanoutService } from 'src/infrastructure/services/personalized-notification-fanout.service';

export interface CreateGeoHelpSpotRequest {
  title: string;
  description?: string | null;
  city: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  section?: GeoHelpSpotSection;
  category?: GeoHelpSpotCategory;
  createdById: string;
}

@Injectable()
export class CreateGeoHelpSpotUseCase {
  constructor(
    @Inject('GeoHelpBoardRepository')
    private readonly geoHelpBoardRepository: GeoHelpBoardRepository,
    private readonly personalizedNotificationFanoutService: PersonalizedNotificationFanoutService,
  ) {}

  async execute(request: CreateGeoHelpSpotRequest): Promise<GeoHelpSpot> {
    const title = request.title.trim();
    const city = request.city.trim();
    const address = request.address?.trim() || null;
    const description = request.description?.trim() || null;
    const section = request.section ?? GeoHelpSpotSection.COMMUNITY_PICK;
    const category = request.category ?? GeoHelpSpotCategory.OTHER;

    if (request.latitude < -90 || request.latitude > 90) {
      throw new GeoHelpBoardValidationError('Latitude must be between -90 and 90');
    }

    if (request.longitude < -180 || request.longitude > 180) {
      throw new GeoHelpBoardValidationError('Longitude must be between -180 and 180');
    }

    const duplicate = await this.geoHelpBoardRepository.findPotentialDuplicate({
      title,
      city,
      section,
      category,
      latitude: request.latitude,
      longitude: request.longitude,
      radiusKm: 0.2,
    });

    if (duplicate) {
      throw new GeoHelpBoardConflictError('A similar spot already exists nearby');
    }

    const created = await this.geoHelpBoardRepository.createSpot({
      title,
      description,
      city,
      address,
      latitude: request.latitude,
      longitude: request.longitude,
      section,
      category,
      createdById: request.createdById,
    });

    await this.personalizedNotificationFanoutService.notifyRelevantUsers({
      type: NotificationType.GEO_HELP_ACTIVITY,
      title: `New place added: ${created.title}`,
      body: [created.description, created.city, created.category]
        .filter(Boolean)
        .join(' '),
      entityType: 'GEO_HELP_SPOT',
      entityId: created.id,
      sourceModule: 'geo-help-board',
      actionUrl: '/geo-help-board',
      excludeUserIds: [request.createdById],
      metadataJson: {
        category: created.category,
        section: created.section,
        city: created.city,
      },
      dedupeKeyPrefix: 'geo-spot-new',
      limit: 5,
      minScore: 0.45,
    });

    return created;
  }
}

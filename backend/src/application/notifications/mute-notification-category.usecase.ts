// src/application/notifications/mute-notification-category.usecase.ts
import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NotificationMuteRepository } from 'src/domain/repositories/notification-mute.repository';
import { NotificationMute, NotificationMuteScope } from 'src/domain/entities/notification-mute.entity';

export interface MuteNotificationCategoryRequest {
  userId: string;
  sourceModule: string; // e.g. 'threads', 'geo-help-board'
  category: string; // e.g. 'ACADEMIC'/'ALUMNI', or a GeoHelpSpotCategory value
}

@Injectable()
export class MuteNotificationCategoryUseCase {
  constructor(
    @Inject('NotificationMuteRepository')
    private readonly muteRepository: NotificationMuteRepository,
  ) {}

  async execute(request: MuteNotificationCategoryRequest): Promise<NotificationMute> {
    if (!request.sourceModule?.trim() || !request.category?.trim()) {
      throw new BadRequestException('sourceModule and category are required');
    }

    const alreadyMuted = await this.muteRepository.isCategoryMuted(
      request.userId,
      request.sourceModule,
      request.category,
    );

    if (alreadyMuted) {
      const existing = (await this.muteRepository.findByUserId(request.userId)).find(
        (m) =>
          m.scope === NotificationMuteScope.CATEGORY &&
          m.sourceModule === request.sourceModule &&
          m.category === request.category,
      );
      return existing as NotificationMute;
    }

    return this.muteRepository.create(
      new NotificationMute(
        randomUUID(),
        request.userId,
        NotificationMuteScope.CATEGORY,
        null,
        null,
        request.category,
        request.sourceModule,
        new Date(),
      ),
    );
  }
}
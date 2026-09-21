// src/application/notifications/mute-notification-source.usecase.ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NotificationMuteRepository } from 'src/domain/repositories/notification-mute.repository';
import type { NotificationRepository } from 'src/domain/repositories/notification.repository';
import { NotificationMute, NotificationMuteScope } from 'src/domain/entities/notification-mute.entity';

@Injectable()
export class MuteNotificationSourceUseCase {
  constructor(
    @Inject('NotificationMuteRepository')
    private readonly muteRepository: NotificationMuteRepository,
    @Inject('NotificationRepository')
    private readonly notificationRepository: NotificationRepository,
  ) {}

  /**
   * Mutes the entity (thread, geo spot, etc.) that a given notification is
   * about — matches the roadmap's POST /notifications/:id/mute-source.
   */
  async execute(notificationId: string, userId: string): Promise<NotificationMute> {
    const notification = await this.notificationRepository.findById(notificationId, userId);

    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    const alreadyMuted = await this.muteRepository.isEntityMuted(
      userId,
      notification.entityType,
      notification.entityId,
    );

    if (alreadyMuted) {
      // Idempotent — muting an already-muted source is a no-op, not an error.
      const existing = (await this.muteRepository.findByUserId(userId)).find(
        (m) =>
          m.scope === NotificationMuteScope.ENTITY &&
          m.entityType === notification.entityType &&
          m.entityId === notification.entityId,
      );
      return existing as NotificationMute;
    }

    return this.muteRepository.create(
      new NotificationMute(
        randomUUID(),
        userId,
        NotificationMuteScope.ENTITY,
        notification.entityType,
        notification.entityId,
        null,
        notification.sourceModule,
        new Date(),
      ),
    );
  }
}
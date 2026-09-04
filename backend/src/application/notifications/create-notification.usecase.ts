import { Inject, Injectable } from '@nestjs/common';
import {
  Notification,
  NotificationChannel,
  NotificationType,
} from 'src/domain/entities/notification.entity';
import type { NotificationRepository } from 'src/domain/repositories/notification.repository';

export interface CreateNotificationRequest {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  sourceModule: string;
  score?: number;
  actionUrl?: string | null;
  dedupeKey?: string | null;
  metadataJson?: Record<string, unknown> | null;
  deliveryChannels?: NotificationChannel[];
}

@Injectable()
export class CreateNotificationUseCase {
  constructor(
    @Inject('NotificationRepository')
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(request: CreateNotificationRequest): Promise<Notification> {
    const now = new Date();

    const notification = new Notification(
      this.generateUniqueId(),
      request.userId,
      request.type,
      request.title,
      request.body,
      request.entityType,
      request.entityId,
      request.sourceModule,
      request.score ?? 0,
      false,
      null,
      null,
      request.actionUrl ?? null,
      request.dedupeKey ?? null,
      request.metadataJson ?? null,
      now,
      now,
    );

    return this.notificationRepository.create(
      notification,
      request.deliveryChannels ?? [NotificationChannel.IN_APP],
    );
  }

  private generateUniqueId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}
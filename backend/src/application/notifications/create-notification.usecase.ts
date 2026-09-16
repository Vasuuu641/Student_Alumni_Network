import { Inject, Injectable } from '@nestjs/common';
import {
  Notification,
  NotificationChannel,
  NotificationType,
} from 'src/domain/entities/notification.entity';
import type { NotificationRepository } from 'src/domain/repositories/notification.repository';
import type { NotificationsRealtimePublisher } from 'src/domain/services/notifications-realtime-publisher';
import { randomUUID } from 'crypto';

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
  /**
   * When true, a repeat event that matches an existing, undismissed
   * notification with the same dedupeKey updates that notification in
   * place (title/body/score refreshed, marked unread again) instead of
   * creating a new row — e.g. multiple replies to the same thread
   * collapse into one "thread is gaining activity" notification rather
   * than spamming one per reply.
   */
  collapsible?: boolean;
  /** How long a notification stays eligible to be collapsed into. Default 4 hours. */
  collapseWindowMinutes?: number;
  /** Title/body used when updating an existing notification instead of creating a fresh one. Falls back to title/body if omitted. */
  collapsedTitle?: string;
  collapsedBody?: string;
}

@Injectable()
export class CreateNotificationUseCase {
  private readonly DEFAULT_COLLAPSE_WINDOW_MINUTES = 240;

  constructor(
    @Inject('NotificationRepository')
    private readonly notificationRepository: NotificationRepository,
    @Inject('NotificationsRealtimePublisher')
    private readonly realtime: NotificationsRealtimePublisher,
  ) {}

  async execute(request: CreateNotificationRequest): Promise<Notification | null> {
    if (request.collapsible && request.dedupeKey) {
      const collapsed = await this.tryCollapseIntoExisting(request);
      if (collapsed) {
        return collapsed;
      }
      // No eligible existing notification found — fall through and
      // create a fresh one below, using the same dedupeKey so the
      // *next* event can collapse into this one.
    }

    const now = new Date();

    const notification = new Notification(
      randomUUID(),
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

    const created = await this.notificationRepository.create(
      notification,
      request.deliveryChannels ?? [NotificationChannel.IN_APP],
    );

    if (!created) {
      return null; // duplicate dedupeKey — nothing to push, nothing to return
    }

    await this.pushRealtime(created.userId, created);
    return created;
  }

  private async tryCollapseIntoExisting(
    request: CreateNotificationRequest,
  ): Promise<Notification | null> {
    const existing = await this.notificationRepository.findActiveByDedupeKey(
      request.userId,
      request.dedupeKey as string,
    );

    if (!existing) {
      return null;
    }

    const windowMinutes = request.collapseWindowMinutes ?? this.DEFAULT_COLLAPSE_WINDOW_MINUTES;
    const ageMinutes = (Date.now() - existing.updatedAt.getTime()) / 60_000;

    if (ageMinutes > windowMinutes) {
      return null; // too old to collapse into — treat as a fresh event
    }

    const activityCount = ((existing.metadataJson?.activityCount as number) ?? 1) + 1;

    const updated = await this.notificationRepository.updateContent(existing.id, {
      title: request.collapsedTitle ?? request.title,
      body: request.collapsedBody ?? request.body,
      score: Math.max(existing.score, request.score ?? 0),
      metadataJson: {
        ...(existing.metadataJson ?? {}),
        ...(request.metadataJson ?? {}),
        activityCount,
      },
      markUnread: true,
    });

    await this.pushRealtime(updated.userId, updated);
    return updated;
  }

  private async pushRealtime(userId: string, notification: Notification): Promise<void> {
    try {
      this.realtime.pushNewNotification(userId, notification);
      const unreadCount = await this.notificationRepository.countUnread(userId);
      this.realtime.pushUnreadCount(userId, unreadCount);
    } catch {
      // never let a socket failure break notification persistence
    }
  }
}
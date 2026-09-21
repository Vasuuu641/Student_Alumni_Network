import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import {
  Notification,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
} from 'src/domain/entities/notification.entity';
import type { NotificationRepository } from 'src/domain/repositories/notification.repository';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    notification: Notification,
    deliveryChannels: NotificationChannel[] = [NotificationChannel.IN_APP],
  ): Promise<Notification | null> {
    if (notification.dedupeKey) {
      const existing = await this.prisma.notification.findFirst({
        where: { userId: notification.userId, dedupeKey: notification.dedupeKey },
      });
      if (existing) {
        return null; // caller treats null as "skipped, duplicate"
      }
    }

    const uniqueChannels = Array.from(new Set(deliveryChannels.length > 0 ? deliveryChannels : [NotificationChannel.IN_APP]));

    const created = await this.prisma.$transaction(async (tx) => {
      const record = await tx.notification.create({
        data: {
          id: notification.id,
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          entityType: notification.entityType,
          entityId: notification.entityId,
          sourceModule: notification.sourceModule,
          actionUrl: notification.actionUrl,
          score: notification.score,
          dedupeKey: notification.dedupeKey,
          metadataJson: notification.metadataJson as any,
          isRead: notification.isRead,
          readAt: notification.readAt,
          dismissedAt: notification.dismissedAt,
          createdAt: notification.createdAt,
          updatedAt: notification.updatedAt,
        },
      });

      if (uniqueChannels.length > 0) {
        await tx.notificationDelivery.createMany({
          data: uniqueChannels.map((channel) => ({
            notificationId: record.id,
            channel,
            status: NotificationDeliveryStatus.DELIVERED,
            sentAt: new Date(),
          })),
        });
      }

      return record;
    });

    return this.toDomain(created);
  }

  async markAsRead(id: string, userId: string): Promise<Notification | null> {
    const existing = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!existing) {
      return null;
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: existing.readAt ?? new Date(),
      },
    });

    return this.toDomain(updated);
  }

async dismiss(id: string, userId: string): Promise<Notification | null> {
  const existing = await this.prisma.notification.findFirst({ where: { id, userId } });
  if (!existing) {
    return null;
  }

  const updated = await this.prisma.notification.update({
    where: { id },
    data: {
      dismissedAt: existing.dismissedAt ?? new Date(),
    },
  });

  return this.toDomain(updated);
}

  async findById(id: string, userId: string): Promise<Notification | null> {
    const record = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    return record ? this.toDomain(record) : null;
  }

  async findByUserId(
    userId: string,
    options: { skip: number; take: number; unreadOnly?: boolean },
  ): Promise<{ notifications: Notification[]; total: number }> {
    const where = {
      userId,
      dismissedAt: null,
      ...(options.unreadOnly ? { isRead: false } : {}),
    };

    const [records, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: options.skip,
        take: options.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications: records.map((record) => this.toDomain(record)),
      total,
    };
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, dismissedAt: null, isRead: false },
    });
  }


  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, dismissedAt: null, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return result.count;
  }

    async findActiveByDedupeKey(userId: string, dedupeKey: string): Promise<Notification | null> {
    const record = await this.prisma.notification.findFirst({
      where: { userId, dedupeKey, dismissedAt: null },
    });

    return record ? this.toDomain(record) : null;
  }

  async updateContent(
    id: string,
    updates: {
      title?: string;
      body?: string;
      score?: number;
      metadataJson?: Record<string, unknown> | null;
      markUnread?: boolean;
    },
  ): Promise<Notification> {
    const record = await this.prisma.notification.update({
      where: { id },
      data: {
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.body !== undefined ? { body: updates.body } : {}),
        ...(updates.score !== undefined ? { score: updates.score } : {}),
        ...(updates.metadataJson !== undefined ? { metadataJson: updates.metadataJson as any } : {}),
        ...(updates.markUnread ? { isRead: false, readAt: null } : {}),
      },
    });

    return this.toDomain(record);
  }

  private toDomain(record: any): Notification {
    return new Notification(
      record.id,
      record.userId,
      record.type as NotificationType,
      record.title,
      record.body,
      record.entityType,
      record.entityId,
      record.sourceModule,
      record.score,
      record.isRead,
      record.readAt,
      record.dismissedAt,
      record.actionUrl,
      record.dedupeKey,
      record.metadataJson,
      record.createdAt,
      record.updatedAt,
    );
  }
}
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

  async create(notification: Notification, deliveryChannels: NotificationChannel[] = [NotificationChannel.IN_APP]): Promise<Notification> {
    const created = await this.prisma.$transaction(async (tx) => {
      const notificationRecord = await tx.notification.create({
        data: {
          id: notification.id,
          userId: notification.userId,
          type: notification.type as unknown as NotificationType,
          title: notification.title,
          body: notification.body,
          entityType: notification.entityType,
          entityId: notification.entityId,
          sourceModule: notification.sourceModule,
          actionUrl: notification.actionUrl,
          score: notification.score,
          dedupeKey: notification.dedupeKey,
          isRead: notification.isRead,
          readAt: notification.readAt,
          dismissedAt: notification.dismissedAt,
          createdAt: notification.createdAt,
          updatedAt: notification.updatedAt,
          ...(notification.metadataJson === null
            ? {}
            : { metadataJson: notification.metadataJson as any }),
        },
      });

      await Promise.all(
        deliveryChannels.map((channel) =>
          tx.notificationDelivery.create({
            data: {
              notificationId: notificationRecord.id,
              channel: channel as NotificationChannel,
              status:
                channel === NotificationChannel.IN_APP
                  ? NotificationDeliveryStatus.DELIVERED
                  : NotificationDeliveryStatus.PENDING,
              sentAt: channel === NotificationChannel.IN_APP ? notification.createdAt : null,
            },
          }),
        ),
      );

      return notificationRecord;
    });

    return this.toDomain(created);
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

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const existing = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new Error(`Notification ${id} not found`);
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

  async dismiss(id: string, userId: string): Promise<Notification> {
    const existing = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new Error(`Notification ${id} not found`);
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        dismissedAt: existing.dismissedAt ?? new Date(),
      },
    });

    return this.toDomain(updated);
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
// src/infrastructure/repositories/prisma-notification-mute.repository.ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma/prisma.service';
import {
  NotificationMute,
  NotificationMuteScope,
} from 'src/domain/entities/notification-mute.entity';
import type { NotificationMuteRepository } from 'src/domain/repositories/notification-mute.repository';

@Injectable()
export class PrismaNotificationMuteRepository implements NotificationMuteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(mute: NotificationMute): Promise<NotificationMute> {
    const record = await this.prisma.notificationMute.create({
      data: {
        id: mute.id || randomUUID(),
        userId: mute.userId,
        scope: mute.scope as NotificationMuteScope,
        entityType: mute.entityType,
        entityId: mute.entityId,
        category: mute.category,
        sourceModule: mute.sourceModule,
      },
    });

    return this.toDomain(record);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.notificationMute.deleteMany({
      where: { id, userId },
    });

    return result.count > 0;
  }

  async findByUserId(userId: string): Promise<NotificationMute[]> {
    const records = await this.prisma.notificationMute.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async isEntityMuted(userId: string, entityType: string, entityId: string): Promise<boolean> {
    const record = await this.prisma.notificationMute.findFirst({
      where: { userId, scope: NotificationMuteScope.ENTITY, entityType, entityId },
    });

    return !!record;
  }

  async isCategoryMuted(userId: string, sourceModule: string, category: string): Promise<boolean> {
    const record = await this.prisma.notificationMute.findFirst({
      where: { userId, scope: NotificationMuteScope.CATEGORY, sourceModule, category },
    });

    return !!record;
  }

  private toDomain(record: any): NotificationMute {
    return new NotificationMute(
      record.id,
      record.userId,
      record.scope as NotificationMuteScope,
      record.entityType,
      record.entityId,
      record.category,
      record.sourceModule,
      record.createdAt,
    );
  }
}
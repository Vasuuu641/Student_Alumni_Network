// src/infrastructure/repositories/prisma-saved-item.repository.ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma/prisma.service';
import { SavedItem } from 'src/domain/entities/saved-item.entity';
import type { SavedItemRepository } from 'src/domain/repositories/saved-item.repository';

@Injectable()
export class PrismaSavedItemRepository implements SavedItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(item: SavedItem): Promise<SavedItem> {
    const record = await this.prisma.savedItem.upsert({
      where: {
        userId_entityType_entityId: {
          userId: item.userId,
          entityType: item.entityType,
          entityId: item.entityId,
        },
      },
      create: {
        id: item.id || randomUUID(),
        userId: item.userId,
        entityType: item.entityType,
        entityId: item.entityId,
      },
      update: {}, // already saved — idempotent no-op, don't touch createdAt
    });

    return this.toDomain(record);
  }

  async unsave(userId: string, entityType: string, entityId: string): Promise<boolean> {
    const result = await this.prisma.savedItem.deleteMany({
      where: { userId, entityType, entityId },
    });

    return result.count > 0;
  }

  async isSaved(userId: string, entityType: string, entityId: string): Promise<boolean> {
    const record = await this.prisma.savedItem.findUnique({
      where: { userId_entityType_entityId: { userId, entityType, entityId } },
    });

    return !!record;
  }

  async findByUserId(userId: string, entityType: string): Promise<SavedItem[]> {
    const records = await this.prisma.savedItem.findMany({
      where: { userId, entityType },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): SavedItem {
    return new SavedItem(record.id, record.userId, record.entityType, record.entityId, record.createdAt);
  }
}
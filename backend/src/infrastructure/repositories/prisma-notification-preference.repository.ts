import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { NotificationPreference } from 'src/domain/entities/notification.entity';
import type { NotificationPreferenceRepository } from 'src/domain/repositories/notification.repository';

@Injectable()
export class PrismaNotificationPreferenceRepository
  implements NotificationPreferenceRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<NotificationPreference | null> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    return preference ? this.toDomain(preference) : null;
  }

  async upsert(
    preference: NotificationPreference,
  ): Promise<NotificationPreference> {
    const record = await this.prisma.notificationPreference.upsert({
      where: { userId: preference.userId },
      create: {
        userId: preference.userId,
        inAppEnabled: preference.inAppEnabled,
        emailEnabled: preference.emailEnabled,
        pushEnabled: preference.pushEnabled,
      },
      update: {
        inAppEnabled: preference.inAppEnabled,
        emailEnabled: preference.emailEnabled,
        pushEnabled: preference.pushEnabled,
      },
    });

    return this.toDomain(record);
  }

  private toDomain(record: any): NotificationPreference {
    return new NotificationPreference(
      record.userId,
      record.inAppEnabled,
      record.emailEnabled,
      record.pushEnabled,
      record.createdAt,
      record.updatedAt,
    );
  }
}

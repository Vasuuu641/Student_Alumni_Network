import { Inject, Injectable } from '@nestjs/common';
import {
  NotificationPreference,
} from 'src/domain/entities/notification.entity';
import type { NotificationPreferenceRepository } from 'src/domain/repositories/notification.repository';

@Injectable()
export class GetNotificationPreferencesUseCase {
  constructor(
    @Inject('NotificationPreferenceRepository')
    private readonly notificationPreferenceRepository: NotificationPreferenceRepository,
  ) {}

  async execute(userId: string): Promise<NotificationPreference> {
    const existing = await this.notificationPreferenceRepository.findByUserId(userId);

    if (existing) {
      return existing;
    }

    const now = new Date();
    return this.notificationPreferenceRepository.upsert(
      new NotificationPreference(userId, true, false, false, now, now),
    );
  }
}
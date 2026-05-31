import { Inject, Injectable } from '@nestjs/common';
import {
  NotificationPreference,
} from 'src/domain/entities/notification.entity';
import type { NotificationPreferenceRepository } from 'src/domain/repositories/notification.repository';

export interface UpdateNotificationPreferencesRequest {
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
}

@Injectable()
export class UpdateNotificationPreferencesUseCase {
  constructor(
    @Inject('NotificationPreferenceRepository')
    private readonly notificationPreferenceRepository: NotificationPreferenceRepository,
  ) {}

  async execute(
    userId: string,
    request: UpdateNotificationPreferencesRequest,
  ): Promise<NotificationPreference> {
    const existing = await this.notificationPreferenceRepository.findByUserId(userId);
    const now = new Date();

    return this.notificationPreferenceRepository.upsert(
      new NotificationPreference(
        userId,
        request.inAppEnabled ?? existing?.inAppEnabled ?? true,
        request.emailEnabled ?? existing?.emailEnabled ?? false,
        request.pushEnabled ?? existing?.pushEnabled ?? false,
        existing?.createdAt ?? now,
        now,
      ),
    );
  }
}
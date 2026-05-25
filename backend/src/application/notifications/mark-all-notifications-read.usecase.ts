import { Inject, Injectable } from '@nestjs/common';
import type { NotificationRepository } from 'src/domain/repositories/notification.repository';

@Injectable()
export class MarkAllNotificationsReadUseCase {
  constructor(
    @Inject('NotificationRepository')
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(userId: string): Promise<{ updatedCount: number }> {
    const updatedCount = await this.notificationRepository.markAllAsRead(userId);
    return { updatedCount };
  }
}
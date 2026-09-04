import { Inject, Injectable } from '@nestjs/common';
import { Notification } from 'src/domain/entities/notification.entity';
import type { NotificationRepository } from 'src/domain/repositories/notification.repository';

@Injectable()
export class ListNotificationsUseCase {
  constructor(
    @Inject('NotificationRepository')
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(
    userId: string,
    options: { skip: number; take: number; unreadOnly?: boolean },
  ): Promise<{ notifications: Notification[]; total: number }> {
    return this.notificationRepository.findByUserId(userId, options);
  }
}
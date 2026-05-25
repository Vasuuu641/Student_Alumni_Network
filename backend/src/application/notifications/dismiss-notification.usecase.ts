import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Notification } from 'src/domain/entities/notification.entity';
import type { NotificationRepository } from 'src/domain/repositories/notification.repository';

@Injectable()
export class DismissNotificationUseCase {
  constructor(
    @Inject('NotificationRepository')
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.dismiss(notificationId, userId);
    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }
    return notification;
  }
}
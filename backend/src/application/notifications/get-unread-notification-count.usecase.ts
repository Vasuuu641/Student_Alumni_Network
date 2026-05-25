import { Inject, Injectable } from '@nestjs/common';
import type { NotificationRepository } from 'src/domain/repositories/notification.repository';

@Injectable()
export class GetUnreadNotificationCountUseCase {
  constructor(
    @Inject('NotificationRepository')
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(userId: string): Promise<number> {
    return this.notificationRepository.countUnread(userId);
  }
}
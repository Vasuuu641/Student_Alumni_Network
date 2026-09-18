// src/application/notifications/unmute-notification.usecase.ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationMuteRepository } from 'src/domain/repositories/notification-mute.repository';

@Injectable()
export class UnmuteNotificationUseCase {
  constructor(
    @Inject('NotificationMuteRepository')
    private readonly muteRepository: NotificationMuteRepository,
  ) {}

  async execute(muteId: string, userId: string): Promise<void> {
    const deleted = await this.muteRepository.delete(muteId, userId);
    if (!deleted) {
      throw new NotFoundException(`Mute ${muteId} not found`);
    }
  }
}
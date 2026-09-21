// src/application/notifications/list-notification-mutes.usecase.ts
import { Inject, Injectable } from '@nestjs/common';
import type { NotificationMuteRepository } from 'src/domain/repositories/notification-mute.repository';
import { NotificationMute } from 'src/domain/entities/notification-mute.entity';

@Injectable()
export class ListNotificationMutesUseCase {
  constructor(
    @Inject('NotificationMuteRepository')
    private readonly muteRepository: NotificationMuteRepository,
  ) {}

  async execute(userId: string): Promise<NotificationMute[]> {
    return this.muteRepository.findByUserId(userId);
  }
}
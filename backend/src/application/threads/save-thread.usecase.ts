// src/application/threads/save-thread.usecase.ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ThreadRepository } from 'src/domain/repositories/thread.repository';
import type { SavedItemRepository } from 'src/domain/repositories/saved-item.repository';
import { SavedItem } from 'src/domain/entities/saved-item.entity';
import { NotificationEligibilityService } from 'src/infrastructure/services/notification-eligibility.service';
import { InterestSignalType } from 'src/domain/entities/user-interest.entity';

@Injectable()
export class SaveThreadUseCase {
  constructor(
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
    @Inject('SavedItemRepository') private readonly savedItemRepository: SavedItemRepository,
    private readonly eligibilityService: NotificationEligibilityService,
  ) {}

  async execute(threadId: string, userId: string): Promise<SavedItem> {
    const thread = await this.threadRepository.findById(threadId);
    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    const saved = await this.savedItemRepository.save(
      new SavedItem(randomUUID(), userId, 'THREAD', threadId, new Date()),
    );

    this.eligibilityService
      .captureSignal(userId, InterestSignalType.THREAD_SAVE, 'THREAD', threadId, thread.panel, 'threads')
      .catch((error) => {
        console.error(`Failed to capture thread save signal: ${error?.message ?? error}`);
      });

    return saved;
  }
}
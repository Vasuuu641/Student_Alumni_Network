// src/application/threads/unsave-thread.usecase.ts
import { Inject, Injectable } from '@nestjs/common';
import type { SavedItemRepository } from 'src/domain/repositories/saved-item.repository';

@Injectable()
export class UnsaveThreadUseCase {
  constructor(
    @Inject('SavedItemRepository') private readonly savedItemRepository: SavedItemRepository,
  ) {}

  async execute(threadId: string, userId: string): Promise<void> {
    // Idempotent — unsaving something not saved is a no-op, not an error.
    await this.savedItemRepository.unsave(userId, 'THREAD', threadId);
  }
}
// src/application/threads/list-saved-threads.usecase.ts
import { Inject, Injectable } from '@nestjs/common';
import type { ThreadRepository } from 'src/domain/repositories/thread.repository';
import type { SavedItemRepository } from 'src/domain/repositories/saved-item.repository';
import { Thread } from 'src/domain/entities/thread.entity';

@Injectable()
export class ListSavedThreadsUseCase {
  constructor(
    @Inject('SavedItemRepository') private readonly savedItemRepository: SavedItemRepository,
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
  ) {}

  async execute(userId: string): Promise<Thread[]> {
    const savedItems = await this.savedItemRepository.findByUserId(userId, 'THREAD');

    const threads = await Promise.all(
      savedItems.map((item) => this.threadRepository.findById(item.entityId)),
    );

    // A saved thread could have since been deleted — filter those out
    // rather than surfacing nulls or throwing.
    return threads.filter((thread): thread is Thread => thread !== null);
  }
}
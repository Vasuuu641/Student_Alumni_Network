import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { ThreadRepository } from 'src/domain/repositories/thread.repository';
import { Thread } from 'src/domain/entities/thread.entity';
import { ThreadAccessPolicy } from './policies/thread-access-policy';
import { Role } from 'src/domain/entities/authorized-user.entity';

@Injectable()
export class GetThreadUseCase {
  constructor(
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
  ) {}

  async execute(threadId: string, userRole: Role): Promise<Thread> {
    const thread = await this.threadRepository.findById(threadId);

    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    ThreadAccessPolicy.validatePanelAccess(userRole, thread.panel);

    await this.threadRepository.incrementViewCount(threadId);

    return thread;
  }
}
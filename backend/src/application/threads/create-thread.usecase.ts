import { Injectable, Inject } from '@nestjs/common';
import type { ThreadRepository } from 'src/domain/repositories/thread.repository';
import { ThreadPanel, ThreadStatus } from 'src/domain/entities/thread.entity';
import { ThreadAccessPolicy } from './policies/thread-access-policy';
import { Role } from 'src/domain/entities/authorized-user.entity';
import type { ThreadLLMService } from 'src/domain/services/thread-llm.service';

@Injectable()
export class CreateThreadUseCase {
  constructor(
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
    @Inject('ThreadLLMService') private readonly threadLLMService: ThreadLLMService,
  ) {}

  async execute(
    userId: string,
    userRole: Role,
    title: string,
    description: string | null,
    panel: ThreadPanel,
  ): Promise<string> {
    ThreadAccessPolicy.validatePanelAccess(userRole, panel);

    const now = new Date();

    const thread = await this.threadRepository.create({
      id: this.generateUniqueId(),
      title,
      description,
      panel,
      status: ThreadStatus.OPEN,
      authorId: userId,
      replyCount: 0,
      lastReplyAt: null,
      viewCount: 0,
      voteScore: 0,
      createdAt: now,
      updatedAt: now,
      isAuthoredBy: (checkUserId: string) => userId === checkUserId,
      isOpen: () => true,
      canAcceptReplies: () => true,
    });

    // Embed in background — don't await so user gets response immediately
    this.threadLLMService.embedThread(thread.id, title).catch((err) => {
      console.error(`Background embed failed for thread ${thread.id}:`, err.message);
    });

    return thread.id;
  }

  private generateUniqueId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}
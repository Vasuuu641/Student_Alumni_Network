import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { ThreadRepository, ThreadReplyRepository } from 'src/domain/repositories/thread.repository';
import { ThreadReply, ReplyStatus } from 'src/domain/entities/thread.entity';
import { CreateNotificationUseCase } from '../notifications/create-notification.usecase';
import { NotificationType } from 'src/domain/entities/notification.entity';
import { NotificationEligibilityService } from 'src/infrastructure/services/notification-eligibility.service';
import { InterestSignalType } from 'src/domain/entities/user-interest.entity';
import type { UserInterestSignalRepository } from 'src/domain/repositories/user-interest.repository';

@Injectable()
export class PostReplyUseCase {
  constructor(
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
    @Inject('ThreadReplyRepository') private readonly replyRepository: ThreadReplyRepository,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
    private readonly eligibilityService: NotificationEligibilityService,
    @Inject('UserInterestSignalRepository')
    private readonly signalRepository: UserInterestSignalRepository,
  ) {}

  async execute(
    threadId: string,
    userId: string,
    content: string,
    parentReplyId: string | null,
  ): Promise<ThreadReply> {
    const thread = await this.threadRepository.findById(threadId);

    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    if (!thread.canAcceptReplies()) {
      throw new ForbiddenException('This thread is closed and not accepting new replies');
    }

    const now = new Date();

    const reply = await this.replyRepository.create({
      id: this.generateUniqueId(),
      threadId,
      content,
      authorId: userId,
      status: ReplyStatus.ACTIVE,
      editedAt: null,
      voteScore: 0,
      parentReplyId,
      createdAt: now,
      updatedAt: now,
      isAuthoredBy: (checkUserId: string) => userId === checkUserId,
      isDeleted: () => false,
    });

    await this.threadRepository.incrementReplyCount(threadId);

    if (thread.authorId !== userId) {
      // Capture reply signal for the replier
      await this.eligibilityService.captureSignal(
        userId,
        InterestSignalType.THREAD_REPLY,
        'THREAD',
        thread.id,
        thread.panel,
        'threads',
      ).catch((error) => {
        console.error(`Failed to capture reply signal: ${error?.message ?? error}`);
      });

      // Check if thread author is interested in notifications about this thread
      const eligibility = await this.eligibilityService.checkEligibility(
        thread.authorId,
        thread.id,
        thread.title,
        `${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
        thread.title,
        thread.panel,
      ).catch((error) => {
        console.error(`Eligibility check failed: ${error?.message ?? error}`);
        return null;
      });

      if (!eligibility || !eligibility.passed) {
        console.log(
          `Notification ineligible for user ${thread.authorId}: ${eligibility?.reason || 'unknown'}`,
        );
        return reply;
      }

      await this.createNotificationUseCase.execute({
        userId: thread.authorId,
        type: NotificationType.THREAD_REPLY,
        title: `New reply on ${thread.title}`,
        body: 'A discussion you started has a new reply.',
        entityType: 'THREAD',
        entityId: thread.id,
        sourceModule: 'threads',
        actionUrl: `/threads/${thread.id}`,
        score: eligibility.finalScore,
        dedupeKey: `thread-reply:${thread.id}:${reply.id}`,
        metadataJson: {
          threadId: thread.id,
          replyId: reply.id,
          actorId: userId,
          aiScore: eligibility.aiScore,
          reason: eligibility.reason,
        },
      }).catch((error) => {
        console.error(`Failed to create thread reply notification for ${thread.id}:`, error?.message ?? error);
      });
    }

    return reply;
  }

  private generateUniqueId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}
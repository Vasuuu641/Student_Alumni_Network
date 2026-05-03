import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { ThreadRepository, ThreadReplyRepository } from 'src/domain/repositories/thread.repository';
import { ThreadReply, ReplyStatus } from 'src/domain/entities/thread.entity';
import { CreateNotificationUseCase } from '../notifications/create-notification.usecase';
import { NotificationType } from 'src/domain/entities/notification.entity';

@Injectable()
export class PostReplyUseCase {
  constructor(
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
    @Inject('ThreadReplyRepository') private readonly replyRepository: ThreadReplyRepository,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
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
      await this.createNotificationUseCase.execute({
        userId: thread.authorId,
        type: NotificationType.THREAD_REPLY,
        title: `New reply on ${thread.title}`,
        body: 'A discussion you started has a new reply.',
        entityType: 'THREAD',
        entityId: thread.id,
        sourceModule: 'threads',
        actionUrl: `/threads/${thread.id}`,
        score: 0.85,
        dedupeKey: `thread-reply:${thread.id}:${reply.id}`,
        metadataJson: {
          threadId: thread.id,
          replyId: reply.id,
          actorId: userId,
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
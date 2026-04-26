import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { ThreadRepository, ThreadReplyRepository } from 'src/domain/repositories/thread.repository';
import { ThreadReply, ReplyStatus } from 'src/domain/entities/thread.entity';

@Injectable()
export class PostReplyUseCase {
  constructor(
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
    @Inject('ThreadReplyRepository') private readonly replyRepository: ThreadReplyRepository,
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

    return reply;
  }

  private generateUniqueId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}
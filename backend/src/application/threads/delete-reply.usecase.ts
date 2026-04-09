import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { ThreadRepository, ThreadReplyRepository } from 'src/domain/repositories/thread.repository';
import { Role } from 'src/domain/entities/authorized-user.entity';
import { ReplyStatus } from 'src/domain/entities/thread.entity';

@Injectable()
export class DeleteReplyUseCase {
  constructor(
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
    @Inject('ThreadReplyRepository') private readonly replyRepository: ThreadReplyRepository,
  ) {}

  async execute(replyId: string, userId: string, userRole: Role): Promise<void> {
    const reply = await this.replyRepository.findById(replyId);

    if (!reply) {
      throw new NotFoundException(`Reply ${replyId} not found`);
    }

    const isAuthor = reply.isAuthoredBy(userId);
    const isAdmin = userRole === Role.ADMIN;

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('You can only delete your own replies');
    }

    if (reply.isDeleted()) {
      throw new ForbiddenException('Reply is already deleted');
    }

    const now = new Date();

    reply.status = ReplyStatus.DELETED;

    await this.replyRepository.update(reply);

    await this.threadRepository.decrementReplyCount(reply.threadId);
  }
}
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { ThreadReplyRepository } from 'src/domain/repositories/thread.repository';
import { ThreadReply, ReplyStatus } from 'src/domain/entities/thread.entity';

@Injectable()
export class EditReplyUseCase {
  constructor(
    @Inject('ThreadReplyRepository') private readonly replyRepository: ThreadReplyRepository,
  ) {}

  async execute(replyId: string, userId: string, content: string): Promise<ThreadReply> {
    const reply = await this.replyRepository.findById(replyId);

    if (!reply) {
      throw new NotFoundException(`Reply ${replyId} not found`);
    }

    if (!reply.isAuthoredBy(userId)) {
      throw new ForbiddenException('You can only edit your own replies');
    }

    if (reply.isDeleted()) {
      throw new ForbiddenException('Cannot edit a deleted reply');
    }

    const now = new Date();

    reply.content = content;
    reply.status = ReplyStatus.EDITED;
    reply.editedAt = now;
    return this.replyRepository.update(reply);
  }
}
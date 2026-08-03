import { Injectable, Inject } from '@nestjs/common';
import type { ThreadReplyRepository } from 'src/domain/repositories/thread.repository';
import { ThreadReply } from 'src/domain/entities/thread.entity';
import { ThreadAttachment } from 'src/domain/entities/threadAttachment.entity';
import type { ThreadAttachmentRepository } from 'src/domain/repositories/threadAttachment.repository';

export interface ReplyWithAttachments extends ThreadReply {
  attachments: ThreadAttachment[];
}

@Injectable()
export class ListRepliesUseCase {
  constructor(
    @Inject('ThreadReplyRepository')
    private readonly replyRepository: ThreadReplyRepository,
    @Inject('ThreadAttachmentRepository')
    private readonly threadAttachmentRepository: ThreadAttachmentRepository,
  ) {}

  
async execute(
    threadId: string,
    skip: number = 0,
    take: number = 50,
    sortBy: 'newest' | 'topVoted' = 'newest',
  ): Promise<{ replies: ReplyWithAttachments[]; total: number }> {
    const { replies, total } = await this.replyRepository.findByThreadId(threadId, { skip, take, sortBy });

    if (!replies.length) {
      return { replies: [], total };
    }

    const attachmentsByReply = await Promise.all(
      replies.map((reply) => this.threadAttachmentRepository.findByReplyId(reply.id)),
    );

    const repliesWithAttachments = replies.map((reply, index) =>
      Object.assign(reply, { attachments: attachmentsByReply[index] }),
    );

    return { replies: repliesWithAttachments, total };
  }
}
import { Injectable, Inject } from '@nestjs/common';
import type { ThreadReplyRepository } from 'src/domain/repositories/thread.repository';
import { ThreadReply } from 'src/domain/entities/thread.entity';

@Injectable()
export class ListRepliesUseCase {
  constructor(
    @Inject('ThreadReplyRepository')
    private readonly replyRepository: ThreadReplyRepository,
  ) {}

  async execute(
    threadId: string,
    skip: number = 0,
    take: number = 50,
    sortBy: 'newest' | 'topVoted' = 'newest',
  ): Promise<{ replies: ThreadReply[]; total: number }> {
    return this.replyRepository.findByThreadId(threadId, { skip, take, sortBy });
  }
}
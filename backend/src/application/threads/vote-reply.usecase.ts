import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { ThreadReplyRepository, ThreadVoteRepository } from 'src/domain/repositories/thread.repository';
import { VoteType } from 'src/domain/entities/thread.entity';

@Injectable()
export class VoteReplyUseCase {
  constructor(
    @Inject('ThreadReplyRepository') private readonly replyRepository: ThreadReplyRepository,
    @Inject('ThreadVoteRepository') private readonly voteRepository: ThreadVoteRepository,
  ) {}

  async execute(replyId: string, userId: string, voteType: VoteType): Promise<number> {
    const reply = await this.replyRepository.findById(replyId);

    if (!reply) {
      throw new NotFoundException(`Reply ${replyId} not found`);
    }

    if (reply.isDeleted()) {
      throw new NotFoundException('Cannot vote on a deleted reply');
    }

    const existing = await this.voteRepository.findReplyVote(replyId, userId);

    if (existing) {
      if (existing.voteType === voteType) {
        await this.voteRepository.deleteReplyVote(replyId, userId);
        const delta = voteType === VoteType.UPVOTE ? -1 : 1;
        await this.voteRepository.updateReplyVoteScore(replyId, delta);
      } else {
        await this.voteRepository.upsertReplyVote(replyId, userId, voteType);
        const delta = voteType === VoteType.UPVOTE ? 2 : -2;
        await this.voteRepository.updateReplyVoteScore(replyId, delta);
      }
    } else {
      await this.voteRepository.upsertReplyVote(replyId, userId, voteType);
      const delta = voteType === VoteType.UPVOTE ? 1 : -1;
      await this.voteRepository.updateReplyVoteScore(replyId, delta);
    }

    const updated = await this.replyRepository.findById(replyId);
    return updated?.voteScore ?? 0;
  }
}
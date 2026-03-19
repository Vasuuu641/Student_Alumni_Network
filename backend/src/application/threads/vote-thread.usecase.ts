import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { ThreadRepository, ThreadVoteRepository } from 'src/domain/repositories/thread.repository';
import { VoteType } from 'src/domain/entities/thread.entity';

@Injectable()
export class VoteThreadUseCase {
  constructor(
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
    @Inject('ThreadVoteRepository') private readonly voteRepository: ThreadVoteRepository,
  ) {}

  async execute(threadId: string, userId: string, voteType: VoteType): Promise<number> {
    const thread = await this.threadRepository.findById(threadId);

    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    const existing = await this.voteRepository.findThreadVote(threadId, userId);

    if (existing) {
      if (existing.voteType === voteType) {
        // Same vote again — remove it (toggle off)
        await this.voteRepository.deleteThreadVote(threadId, userId);
        const delta = voteType === VoteType.UPVOTE ? -1 : 1;
        await this.voteRepository.updateThreadVoteScore(threadId, delta);
      } else {
        // Switching vote (up → down or down → up)
        await this.voteRepository.upsertThreadVote(threadId, userId, voteType);
        const delta = voteType === VoteType.UPVOTE ? 2 : -2;
        await this.voteRepository.updateThreadVoteScore(threadId, delta);
      }
    } else {
      // New vote
      await this.voteRepository.upsertThreadVote(threadId, userId, voteType);
      const delta = voteType === VoteType.UPVOTE ? 1 : -1;
      await this.voteRepository.updateThreadVoteScore(threadId, delta);
    }

    const updated = await this.threadRepository.findById(threadId);
    return updated?.voteScore ?? 0;
  }
}
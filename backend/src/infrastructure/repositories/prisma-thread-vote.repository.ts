import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma/prisma.service";
import { ThreadVoteRepository } from "src/domain/repositories/thread.repository";

type VoteValue = 'UPVOTE' | 'DOWNVOTE';

@Injectable()
export class PrismaThreadVoteRepository implements ThreadVoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findThreadVote(threadId: string, userId: string): Promise<{ voteType: VoteValue } | null> {
    const found = await this.prisma.threadVote.findUnique({
      where: { threadId_userId: { threadId, userId } },
    });
    return found ? { voteType: found.voteType as VoteValue } : null;
  }

  async countThreadVotesByType(threadId: string, voteType: VoteValue): Promise<number> {
    return this.prisma.threadVote.count({
      where: { threadId, voteType },
    });
  }

  async upsertThreadVote(threadId: string, userId: string, voteType: VoteValue): Promise<void> {
    await this.prisma.threadVote.upsert({
      where: { threadId_userId: { threadId, userId } },
      update: { voteType },
      create: { threadId, userId, voteType },
    });
  }

  async deleteThreadVote(threadId: string, userId: string): Promise<void> {
    await this.prisma.threadVote.delete({
      where: { threadId_userId: { threadId, userId } },
    });
  }

  async updateThreadVoteScore(threadId: string, delta: number): Promise<void> {
    await this.prisma.thread.update({
      where: { id: threadId },
      data: { voteScore: { increment: delta } },
    });
  }

  async findReplyVote(replyId: string, userId: string): Promise<{ voteType: VoteValue } | null> {
    const found = await this.prisma.threadReplyVote.findUnique({
      where: { replyId_userId: { replyId, userId } },
    });
    return found ? { voteType: found.voteType as VoteValue } : null;
  }

  async countReplyVotesByType(replyId: string, voteType: VoteValue): Promise<number> {
    return this.prisma.threadReplyVote.count({
      where: { replyId, voteType },
    });
  }

  async upsertReplyVote(replyId: string, userId: string, voteType: VoteValue): Promise<void> {
    await this.prisma.threadReplyVote.upsert({
      where: { replyId_userId: { replyId, userId } },
      update: { voteType },
      create: { replyId, userId, voteType },
    });
  }

  async deleteReplyVote(replyId: string, userId: string): Promise<void> {
    await this.prisma.threadReplyVote.delete({
      where: { replyId_userId: { replyId, userId } },
    });
  }

  async updateReplyVoteScore(replyId: string, delta: number): Promise<void> {
    await this.prisma.threadReply.update({
      where: { id: replyId },
      data: { voteScore: { increment: delta } },
    });
  }
}
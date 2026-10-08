import { Injectable } from "@nestjs/common";
import type { ThreadStatus as PrismaThreadStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { ThreadRepository } from "src/domain/repositories/thread.repository";
import { Thread } from "src/domain/entities/thread.entity";
import { ThreadStatus } from "src/domain/entities/thread.entity";
import { ThreadPanel } from "src/domain/entities/thread.entity";

const PRISMA_THREAD_STATUS_DELETED = 'DELETED' as PrismaThreadStatus;

@Injectable()
export class PrismaThreadRepository implements ThreadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Thread | null> {
    const found = await this.prisma.thread.findFirst({
      where: {
        id,
        status: { not: PRISMA_THREAD_STATUS_DELETED },
      },
    });
    return found ? this.toDomain(found) : null;
  }

  async findByAuthorId(authorId: string): Promise<Thread[]> {
    const records = await this.prisma.thread.findMany({
      where: {
        authorId,
        status: { not: PRISMA_THREAD_STATUS_DELETED },
      },
    });
    return records.map((r) => this.toDomain(r));
  }

  async create(thread: Thread): Promise<Thread> {
    const created = await this.prisma.thread.create({
      data: {
        id: thread.id,
        title: thread.title,
        description: thread.description,
        panel: thread.panel,
        status: thread.status as unknown as PrismaThreadStatus,
        authorId: thread.authorId,
        replyCount: thread.replyCount,
        lastReplyAt: thread.lastReplyAt,
        viewCount: thread.viewCount,
        voteScore: thread.voteScore,
      },
    });
    return this.toDomain(created);
  }

  async update(thread: Thread): Promise<Thread> {
    const updated = await this.prisma.thread.update({
      where: { id: thread.id },
      data: {
        title: thread.title,
        description: thread.description,
        panel: thread.panel,
        status: thread.status as unknown as PrismaThreadStatus,
        // authorId intentionally excluded — Prisma does not allow
        // updating relation foreign keys directly on update
        replyCount: thread.replyCount,
        lastReplyAt: thread.lastReplyAt,
        viewCount: thread.viewCount,
        voteScore: thread.voteScore,
      },
    });
    return this.toDomain(updated);
  }

  async updateStatus(threadId: string, status: ThreadStatus): Promise<Thread> {
    const updated = await this.prisma.thread.update({
      where: { id: threadId },
      data: { status: status as unknown as PrismaThreadStatus },
    });
    return this.toDomain(updated);
  }
  
 async listByPanel(
  panel: ThreadPanel,
  options: { skip: number; take: number; sortBy: string },
): Promise<{ threads: Thread[]; total: number }> {
  const [records, total] = await Promise.all([
    this.prisma.thread.findMany({
      where: {
        panel,
        status: { not: PRISMA_THREAD_STATUS_DELETED },
      },
    }),
    this.prisma.thread.count({
      where: {
        panel,
        status: { not: PRISMA_THREAD_STATUS_DELETED },
      },
    }),
  ]);

  const sorted = records
    .slice()
    .sort((a, b) => {
      const pinnedRank = (a.status === 'PINNED' ? 0 : 1) - (b.status === 'PINNED' ? 0 : 1);
      if (pinnedRank !== 0) return pinnedRank;

      if (options.sortBy === 'mostReplies') {
        const replyRank = b.replyCount - a.replyCount;
        if (replyRank !== 0) return replyRank;
      } else if (options.sortBy === 'topVoted') {
        const voteRank = b.voteScore - a.voteScore;
        if (voteRank !== 0) return voteRank;
      } else {
        const createdRank = b.createdAt.getTime() - a.createdAt.getTime();
        if (createdRank !== 0) return createdRank;
      }

      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

  const paged = sorted.slice(options.skip, options.skip + options.take);

  return { threads: paged.map((r) => this.toDomain(r)), total };
}

  async incrementViewCount(threadId: string): Promise<void> {
    await this.prisma.thread.update({
      where: { id: threadId },
      data: { viewCount: { increment: 1 } },
    });
  }

  async incrementReplyCount(threadId: string): Promise<void> {
    await this.prisma.thread.update({
      where: { id: threadId },
      data: { replyCount: { increment: 1 }, lastReplyAt: new Date() },
    });
  }

  async decrementReplyCount(threadId: string): Promise<void> {
    await this.prisma.thread.update({
      where: { id: threadId },
      data: { replyCount: { decrement: 1 } },
    });
  }

  private toDomain(record: any): Thread {
    return new Thread(
      record.id,
      record.title,
      record.description,
      record.panel as ThreadPanel,
      record.status as ThreadStatus,
      record.authorId,
      record.replyCount,
      record.lastReplyAt,
      record.viewCount,
      record.voteScore,
      record.createdAt,
      record.updatedAt,
    );
  }
}
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma/prisma.service";
import { ThreadReplyRepository } from "src/domain/repositories/thread.repository";
import { ThreadReply, ReplyStatus } from "src/domain/entities/thread.entity";

@Injectable()
export class PrismaThreadReplyRepository implements ThreadReplyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ThreadReply | null> {
    const found = await this.prisma.threadReply.findUnique({ where: { id } });
    return found ? this.toDomain(found) : null;
  }

  async findByThreadId(
    threadId: string,
    options: { skip: number; take: number; sortBy: 'newest' | 'topVoted' },
  ): Promise<{ replies: ThreadReply[]; total: number }> {
    const orderBy =
      options.sortBy === 'topVoted'
        ? { voteScore: 'desc' as const }
        : { createdAt: 'desc' as const };

    const [replies, total] = await Promise.all([
      this.prisma.threadReply.findMany({
        where: {
          threadId,
          status: { not: ReplyStatus.DELETED },
        },
        skip: options.skip,
        take: options.take,
        orderBy,
      }),
      this.prisma.threadReply.count({
        where: {
          threadId,
          status: { not: ReplyStatus.DELETED },
        },
      }),
    ]);

    return {
      replies: replies.map((r) => this.toDomain(r)),
      total,
    };
  }

  async findChildReplies(parentReplyId: string): Promise<ThreadReply[]> {
    const records = await this.prisma.threadReply.findMany({
      where: {
        parentReplyId,
        status: { not: ReplyStatus.DELETED },
      },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async create(reply: ThreadReply): Promise<ThreadReply> {
    const created = await this.prisma.threadReply.create({
      data: {
        id: reply.id,
        threadId: reply.threadId,
        parentReplyId: reply.parentReplyId,
        authorId: reply.authorId,
        content: reply.content,
        status: reply.status,
        voteScore: reply.voteScore,
      },
    });
    return this.toDomain(created);
  }

  async update(reply: ThreadReply): Promise<ThreadReply> {
    const updated = await this.prisma.threadReply.update({
      where: { id: reply.id },
      data: {
        content: reply.content,
        status: reply.status,
        editedAt: reply.editedAt,
        voteScore: reply.voteScore,
      },
    });
    return this.toDomain(updated);
  }

  async delete(replyId: string): Promise<void> {
    await this.prisma.threadReply.delete({ where: { id: replyId } });
  }

  private toDomain(record: any): ThreadReply {
    return new ThreadReply(
      record.id,
      record.threadId,
      record.content,
      record.authorId,
      record.status as ReplyStatus,
      record.editedAt,
      record.voteScore,
      record.parentReplyId,
      record.createdAt,
      record.updatedAt,
    );
  }
}
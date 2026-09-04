// infrastructure/repositories/prisma-thread-attachment.repository.ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma/prisma.service';
import {
  ThreadAttachmentRepository,
  CreateThreadAttachmentData,
} from 'src/domain/repositories/threadAttachment.repository';
import { ThreadAttachment } from 'src/domain/entities/threadAttachment.entity';

@Injectable()
export class PrismaThreadAttachmentRepository implements ThreadAttachmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateThreadAttachmentData): Promise<ThreadAttachment> {
    const created = await this.prisma.threadAttachment.create({
      data: {
        id: randomUUID(),
        threadId: data.threadId,
        replyId: data.replyId,
        key: data.key,
        url: data.url,
        mimeType: data.mimeType,
        size: data.size,
        uploadedById: data.uploadedById,
      },
    });
    return this.toDomain(created);
  }

  async findByThreadId(threadId: string): Promise<ThreadAttachment[]> {
    const records = await this.prisma.threadAttachment.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByReplyId(replyId: string): Promise<ThreadAttachment[]> {
    const records = await this.prisma.threadAttachment.findMany({
      where: { replyId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.threadAttachment.delete({ where: { id } });
  }

  private toDomain(record: any): ThreadAttachment {
    return new ThreadAttachment(
      record.id,
      record.threadId,
      record.replyId,
      record.key,
      record.url,
      record.mimeType,
      record.size,
      record.uploadedById,
      record.createdAt,
    );
  }
}
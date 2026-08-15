// infrastructure/repositories/prisma-study-group-post-attachment.repository.ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma/prisma.service';
import {
  StudyGroupPostAttachmentRepository,
  CreateStudyGroupPostAttachmentData,
} from 'src/domain/repositories/study-group-post-attachment.repository';
import { StudyGroupPostAttachment } from 'src/domain/entities/study-group.entity'; // adjust path

@Injectable()
export class PrismaStudyGroupPostAttachmentRepository implements StudyGroupPostAttachmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateStudyGroupPostAttachmentData): Promise<StudyGroupPostAttachment> {
    const created = await this.prisma.studyGroupPostAttachment.create({
      data: {
        id: randomUUID(),
        postId: data.postId,
        key: data.key,
        url: data.url,
        mimeType: data.mimeType,
        size: data.size,
        uploadedById: data.uploadedById,
      },
    });
    return this.toDomain(created);
  }

  async findByPostId(postId: string): Promise<StudyGroupPostAttachment[]> {
    const records = await this.prisma.studyGroupPostAttachment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.studyGroupPostAttachment.delete({ where: { id } });
  }

  private toDomain(record: any): StudyGroupPostAttachment {
    return new StudyGroupPostAttachment(
      record.id,
      record.postId,
      record.key,
      record.url,
      record.mimeType,
      record.size,
      record.uploadedById,
      record.createdAt,
    );
  }
}
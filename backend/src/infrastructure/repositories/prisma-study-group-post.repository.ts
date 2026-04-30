import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma/prisma.service";
import { StudyGroupPostRepository } from "src/domain/repositories/study-group-post.repository";
import { studyGroupPostStatus } from "src/domain/entities/study-group.entity";

@Injectable()
export class PrismaStudyGroupPostRepository implements StudyGroupPostRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<{ id: string; studyGroupId: string; authorId: string; content: string; status: studyGroupPostStatus; createdAt: Date; updatedAt: Date } | null> {
    const found = await this.prisma.studyGroupPost.findUnique({ where: { id } });
    return found ? this.toDomain(found) : null;
  }

  async findByStudyGroupId(studyGroupId: string): Promise<{ id: string; authorId: string; content: string; status: studyGroupPostStatus; createdAt: Date; updatedAt: Date }[]> {
    const records = await this.prisma.studyGroupPost.findMany({ where: { groupId: studyGroupId } });
    return records.map((record) => this.toDomain(record));
  }

  async create(post: { studyGroupId: string; authorId: string; content: string }): Promise<{ id: string; studyGroupId: string; authorId: string; content: string; status: studyGroupPostStatus; createdAt: Date; updatedAt: Date }> {
    const created = await this.prisma.studyGroupPost.create({
      data: { groupId: post.studyGroupId, authorId: post.authorId, content: post.content } as any,
    });
    return { id: created.id, studyGroupId: created.groupId, authorId: created.authorId, content: created.content, status: studyGroupPostStatus[created.status as unknown as keyof typeof studyGroupPostStatus] };
  }

  async update(postId: string, content: string): Promise<{ id: string; studyGroupId: string; authorId: string; content: string; status: studyGroupPostStatus; createdAt: Date; updatedAt: Date }> {
    const updated = await this.prisma.studyGroupPost.update({ where: { id: postId }, data: { content } });
    return this.toDomain(updated);
  }

  async updateStatus(postId: string, status: studyGroupPostStatus): Promise<{ id: string; studyGroupId: string; authorId: string; content: string; status: studyGroupPostStatus; createdAt: Date; updatedAt: Date }> {
    const updated = await this.prisma.studyGroupPost.update({ where: { id: postId }, data: { status: status as any } });
    return this.toDomain(updated);
  }

  async delete(postId: string): Promise<{ id: string; groupId: string }> {
    const post = await this.prisma.studyGroupPost.findUnique({ where: { id: postId } });
    if (!post) throw new Error('Post not found');
    
    await this.prisma.studyGroupPost.delete({ where: { id: postId } });
    return { id: post.id, groupId: post.groupId };
  }

  private toDomain(record: any): { id: string; studyGroupId: string; authorId: string; content: string; status: studyGroupPostStatus; createdAt: Date; updatedAt: Date } {
    return {
      id: record.id,
      studyGroupId: record.groupId,
      authorId: record.authorId,
      content: record.content,
      status: studyGroupPostStatus[record.status as unknown as keyof typeof studyGroupPostStatus],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import type { StudyGroupUserArchiveRepository } from '../../domain/repositories/study-group-user-archive.repository';

@Injectable()
export class PrismaStudyGroupUserArchiveRepository implements StudyGroupUserArchiveRepository {
  constructor(private readonly prisma: PrismaService) {}

  async archiveForUser(groupId: string, userId: string): Promise<void> {
    await (this.prisma as any).studyGroupUserArchive.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: { archivedAt: new Date() },
      create: { groupId, userId },
    });
  }

  async unarchiveForUser(groupId: string, userId: string): Promise<void> {
    await (this.prisma as any).studyGroupUserArchive.deleteMany({
      where: { groupId, userId },
    });
  }

  async findArchivedGroupIdsByUserId(userId: string): Promise<string[]> {
    const records = await (this.prisma as any).studyGroupUserArchive.findMany({
      where: { userId },
      select: { groupId: true },
      orderBy: { archivedAt: 'desc' },
    });

    return records.map((record) => record.groupId);
  }
}

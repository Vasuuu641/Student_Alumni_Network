import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import type { StudyGroupUserArchiveRepository } from '../../domain/repositories/study-group-user-archive.repository';

@Injectable()
export class PrismaStudyGroupUserArchiveRepository implements StudyGroupUserArchiveRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get archiveDelegate(): any | null {
    return (this.prisma as any).studyGroupUserArchive ?? null;
  }

  async archiveForUser(groupId: string, userId: string): Promise<void> {
    const delegate = this.archiveDelegate;
    if (!delegate) {
      throw new Error('Study group archives are unavailable. Prisma client is missing studyGroupUserArchive delegate.');
    }

    await delegate.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: { archivedAt: new Date() },
      create: { groupId, userId },
    });
  }

  async unarchiveForUser(groupId: string, userId: string): Promise<void> {
    const delegate = this.archiveDelegate;
    if (!delegate) {
      throw new Error('Study group archives are unavailable. Prisma client is missing studyGroupUserArchive delegate.');
    }

    await delegate.deleteMany({
      where: { groupId, userId },
    });
  }

  async findArchivedGroupIdsByUserId(userId: string): Promise<string[]> {
    const delegate = this.archiveDelegate;
    if (!delegate) {
      throw new Error('Study group archives are unavailable. Prisma client is missing studyGroupUserArchive delegate.');
    }

    const records = await delegate.findMany({
      where: { userId },
      select: { groupId: true },
      orderBy: { archivedAt: 'desc' },
    });

    return records.map((record) => record.groupId);
  }
}

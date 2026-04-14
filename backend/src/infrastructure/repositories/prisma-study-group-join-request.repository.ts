import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import type {
  StudyGroupJoinRequestRecord,
  StudyGroupJoinRequestRepository,
  StudyGroupJoinRequestStatus,
  StudyGroupJoinRequestView,
} from '../../domain/repositories/study-group-join-request.repository';

@Injectable()
export class PrismaStudyGroupJoinRequestRepository implements StudyGroupJoinRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPendingByGroupAndUser(groupId: string, userId: string): Promise<StudyGroupJoinRequestRecord | null> {
    const found = await (this.prisma as any).studyGroupJoinRequest.findFirst({
      where: {
        groupId,
        userId,
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return found ? this.toRecord(found) : null;
  }

  async createPending(groupId: string, userId: string): Promise<StudyGroupJoinRequestRecord> {
    const created = await (this.prisma as any).studyGroupJoinRequest.create({
      data: {
        groupId,
        userId,
        status: 'PENDING',
      },
    });

    return this.toRecord(created);
  }

  async findById(id: string): Promise<StudyGroupJoinRequestRecord | null> {
    const found = await (this.prisma as any).studyGroupJoinRequest.findUnique({ where: { id } });
    return found ? this.toRecord(found) : null;
  }

  async listPendingByGroupId(groupId: string): Promise<StudyGroupJoinRequestView[]> {
    const requests = await (this.prisma as any).studyGroupJoinRequest.findMany({
      where: {
        groupId,
        status: 'PENDING',
      },
      include: {
        user: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return requests.map((request: any) => ({
      id: request.id,
      groupId: request.groupId,
      userId: request.userId,
      userName: `${request.user?.firstName ?? ''} ${request.user?.lastName ?? ''}`.trim() || request.user?.email || request.userId,
      userEmail: request.user?.email ?? '',
      status: request.status,
      createdAt: request.createdAt,
    }));
  }

  async updateStatus(id: string, status: StudyGroupJoinRequestStatus): Promise<void> {
    await (this.prisma as any).studyGroupJoinRequest.update({
      where: { id },
      data: { status },
    });
  }

  private toRecord(record: any): StudyGroupJoinRequestRecord {
    return {
      id: record.id,
      groupId: record.groupId,
      userId: record.userId,
      status: record.status,
      createdAt: record.createdAt,
    };
  }
}

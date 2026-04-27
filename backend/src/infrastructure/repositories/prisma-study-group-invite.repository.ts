import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import type {
  CreateStudyGroupInviteInput,
  StudyGroupInviteRecord,
  StudyGroupInviteRepository,
  StudyGroupInviteView,
} from '../../domain/repositories/study-group-invite.repository';

@Injectable()
export class PrismaStudyGroupInviteRepository implements StudyGroupInviteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActivePendingInvite(groupId: string, invitedUserId: string, now: Date): Promise<StudyGroupInviteRecord | null> {
    const record = await (this.prisma as any).studyGroupInvite.findFirst({
      where: {
        groupId,
        invitedUserId,
        acceptedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    return record ? this.toRecord(record) : null;
  }

  async create(input: CreateStudyGroupInviteInput): Promise<StudyGroupInviteRecord> {
    const created = await (this.prisma as any).studyGroupInvite.create({
      data: {
        groupId: input.groupId,
        invitedUserId: input.invitedUserId,
        invitedBy: input.invitedBy,
        token: input.token,
        expiresAt: input.expiresAt,
      },
    });

    return this.toRecord(created);
  }

  async findById(id: string): Promise<StudyGroupInviteRecord | null> {
    const found = await (this.prisma as any).studyGroupInvite.findUnique({ where: { id } });
    return found ? this.toRecord(found) : null;
  }

  async markAccepted(id: string, acceptedAt: Date): Promise<void> {
    await (this.prisma as any).studyGroupInvite.update({
      where: { id },
      data: { acceptedAt },
    });
  }

  async delete(id: string): Promise<void> {
    await (this.prisma as any).studyGroupInvite.delete({ where: { id } });
  }

  async findPendingForUser(userId: string, now: Date): Promise<StudyGroupInviteView[]> {
    const invites = await (this.prisma as any).studyGroupInvite.findMany({
      where: {
        invitedUserId: userId,
        acceptedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        group: true,
        inviter: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((invite: any) => ({
      id: invite.id,
      groupId: invite.groupId,
      groupName: invite.group?.name ?? 'Unknown group',
      invitedBy: invite.invitedBy,
      invitedByName:
        `${invite.inviter?.firstName ?? ''} ${invite.inviter?.lastName ?? ''}`.trim() ||
        invite.inviter?.email ||
        invite.invitedBy,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    }));
  }

  private toRecord(record: any): StudyGroupInviteRecord {
    return {
      id: record.id,
      groupId: record.groupId,
      invitedUserId: record.invitedUserId,
      invitedBy: record.invitedBy,
      token: record.token,
      expiresAt: record.expiresAt,
      acceptedAt: record.acceptedAt,
      createdAt: record.createdAt,
    };
  }
}

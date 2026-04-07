import { Injectable } from "@nestjs/common";
import { studyGroupJoinStatus as PrismaStudyGroupJoinStatus, studyGroupMemberRole as PrismaStudyGroupMemberRole } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { StudyGroupMemberRepository } from "src/domain/repositories/study-group-member.repository";
import { studyGroupMemberRole, studyGroupJoinStatus } from "src/domain/entities/study-group.entity";

@Injectable()
export class PrismaStudyGroupMemberRepository implements StudyGroupMemberRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByStudyGroupId(studyGroupId: string): Promise<{ userId: string; role: studyGroupMemberRole; joinStatus: studyGroupJoinStatus }[]> {
    const records = await this.prisma.studyGroupMember.findMany({
      where: { groupId: studyGroupId },
    });
    return records.map((r) => {
      const d = this.toDomain(r);
      return { userId: d.userId, role: d.role, joinStatus: d.joinStatus };
    });
  }

  async findByUserId(userId: string): Promise<{ studyGroupId: string; role: studyGroupMemberRole; joinStatus: studyGroupJoinStatus }[]> {
    const records = await this.prisma.studyGroupMember.findMany({
      where: { userId },
    });
    return records.map((r) => {
      const d = this.toDomain(r);
      return { studyGroupId: d.groupId, role: d.role, joinStatus: d.joinStatus };
    });
  }

  async addMember(studyGroupId: string, userId: string, role: studyGroupMemberRole): Promise<void> {
    const roleValue: PrismaStudyGroupMemberRole =
      (typeof role === 'number' ? studyGroupMemberRole[role] : String(role)).toUpperCase() as PrismaStudyGroupMemberRole;
    const joinStatusValue: PrismaStudyGroupJoinStatus = PrismaStudyGroupJoinStatus.PENDING;
    await this.prisma.studyGroupMember.create({
      data: { groupId: studyGroupId, userId, role: roleValue, joinStatus: joinStatusValue },
    });
  }

  async updateMemberRole(studyGroupId: string, userId: string, role: studyGroupMemberRole): Promise<void> {
    const roleValue: PrismaStudyGroupMemberRole =
      (typeof role === 'number' ? studyGroupMemberRole[role] : String(role)).toUpperCase() as PrismaStudyGroupMemberRole;
    await this.prisma.studyGroupMember.update({
      where: { groupId_userId: { groupId: studyGroupId, userId } },
      data: { role: roleValue },
    });
  }

  async updateMemberJoinStatus(studyGroupId: string, userId: string, joinStatus: studyGroupJoinStatus): Promise<void> {
    const joinStatusValue: PrismaStudyGroupJoinStatus =
      (typeof joinStatus === 'number' ? studyGroupJoinStatus[joinStatus] : String(joinStatus)).toUpperCase() as PrismaStudyGroupJoinStatus;
    await this.prisma.studyGroupMember.update({
      where: { groupId_userId: { groupId: studyGroupId, userId } },
      data: { joinStatus: joinStatusValue },
    });
  }

  async removeMember(studyGroupId: string, userId: string): Promise<void> {
    await this.prisma.studyGroupMember.delete({
      where: { groupId_userId: { groupId: studyGroupId, userId } },
    });
  }

  private toDomain(record: any): { groupId: string; userId: string; role: studyGroupMemberRole; joinStatus: studyGroupJoinStatus } {
    return {
      groupId: record.groupId,
      userId: record.userId,
      role: studyGroupMemberRole[record.role as unknown as keyof typeof studyGroupMemberRole],
      joinStatus: studyGroupJoinStatus[record.joinStatus as unknown as keyof typeof studyGroupJoinStatus],
    };
  }
}
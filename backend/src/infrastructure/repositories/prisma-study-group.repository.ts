import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma/prisma.service";
import { StudyGroupRepository } from "src/domain/repositories/study-group.repository";
import { StudyGroup, studyGroupsVisibility, studyGroupStatus } from "src/domain/entities/study-group.entity";

@Injectable()
export class PrismaStudyGroupRepository implements StudyGroupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<StudyGroup | null> {
    const found = await this.prisma.studyGroup.findUnique({ where: { id } });
    return found ? this.toDomain(found) : null;
  }

  async findByOwnerId(memberId: string): Promise<StudyGroup[]> {
    const records = await this.prisma.studyGroup.findMany({
      where: {
        ownerId: memberId,
      },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByVisibility(visibility: studyGroupsVisibility): Promise<StudyGroup[]> {
    const records = await this.prisma.studyGroup.findMany({
      where: {
        visibility: { equals: typeof visibility === 'number' ? (studyGroupsVisibility[visibility] as any) : String(visibility).toUpperCase() },
      },
    });
    return records.map((r) => this.toDomain(r));
  }

  async create(studyGroup: StudyGroup): Promise<StudyGroup> {
    const visibilityValue = typeof studyGroup.visibility === 'number'
      ? (studyGroupsVisibility[studyGroup.visibility] as any)
      : String(studyGroup.visibility).toUpperCase();
    const statusValue = typeof studyGroup.status === 'number'
      ? (studyGroupStatus[studyGroup.status] as any)
      : String(studyGroup.status).toUpperCase();

    const data: any = {
      name: studyGroup.name,
      description: studyGroup.description,
      ownerId: studyGroup.ownerId,
      visibility: visibilityValue,
      status: statusValue,
    };
    if (studyGroup.id) data.id = studyGroup.id;

    const created = await this.prisma.studyGroup.create({ data });
    return this.toDomain(created);
  }

  async update(studyGroup: StudyGroup): Promise<StudyGroup> {
    const updated = await this.prisma.studyGroup.update({
      where: { id: studyGroup.id },
      data: { name: studyGroup.name, description: studyGroup.description },
    });
    return this.toDomain(updated);
  }

  async updateStatus(studyGroupId: string, status: studyGroupStatus): Promise<StudyGroup> {
    const updated = await this.prisma.studyGroup.update({
      where: { id: studyGroupId },
      data: { status: typeof status === 'number' ? (studyGroupStatus[status] as any) : String(status).toUpperCase() },
    });
    return this.toDomain(updated);
  }

  async delete(studyGroupId: string): Promise<void> {
    await this.prisma.studyGroup.delete({ where: { id: studyGroupId } });
  }

  private toDomain(record: any): StudyGroup {
    return new StudyGroup(
      record.id,
      record.name,
      record.description,
      // record.visibility/status are Prisma enum strings; convert to domain enums
      (studyGroupsVisibility[record.visibility as unknown as keyof typeof studyGroupsVisibility] as unknown) as studyGroupsVisibility,
      (studyGroupStatus[record.status as unknown as keyof typeof studyGroupStatus] as unknown) as studyGroupStatus,
      record.ownerId,
      record.createdAt,
      record.updatedAt,
    );
  }
}   
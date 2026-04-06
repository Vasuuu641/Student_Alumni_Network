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
        visibility: { equals: visibility as any },
      },
    });
    return records.map((r) => this.toDomain(r));
  }

  async create(studyGroup: StudyGroup): Promise<StudyGroup> {
    const created = await this.prisma.studyGroup.create({
      data: { id: studyGroup.id, name: studyGroup.name, description: studyGroup.description } as any,
    });
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
      data: { status: status as any },
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
      record.ownerId,
      record.visibility,
      record.status,
      record.createdAt,
      record.updatedAt
    );
  }
}   
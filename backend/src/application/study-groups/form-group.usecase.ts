import { Inject, Injectable } from '@nestjs/common';
import { StudyGroup } from '../../domain/entities/study-group.entity';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import { studyGroupsVisibility, studyGroupStatus } from '../../domain/entities/study-group.entity';

export interface FormGroupRequest {
  name: string;
  description: string;
  visibility: studyGroupsVisibility;
  ownerId: string;
  maxMembers?: number | null;
}

@Injectable()
export class FormGroupUseCase {
  constructor(
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
  ) {}

  async execute(request: FormGroupRequest): Promise<StudyGroup> {
    const { name, description, visibility, ownerId, maxMembers = null } = request;

    const now = new Date();

    const group = new StudyGroup(
      undefined as any,
      name,
      description,
      visibility,
      studyGroupStatus.ACTIVE,
      ownerId,
      now,
      now,
    );

    // Persist and return the created domain entity
    const created = await this.studyGroupRepository.create(group);
    return created;
  }
}

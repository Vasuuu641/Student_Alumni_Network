import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import { StudyGroup } from '../../domain/entities/study-group.entity';
import { studyGroupStatus } from '../../domain/entities/study-group.entity';

export interface GetGroupRequest {
  id: string;
}

@Injectable()
export class GetGroupUseCase {
  constructor(
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
  ) {}

  async execute(request: GetGroupRequest): Promise<StudyGroup> {
    const group = await this.studyGroupRepository.findById(request.id);
    if (!group || group.status !== studyGroupStatus.ACTIVE) throw new Error('Study group not found');
    return group;
  }
}

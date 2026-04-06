import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import { StudyGroup } from '../../domain/entities/study-group.entity';
import { studyGroupStatus } from '../../domain/entities/study-group.entity';

export interface UpdateGroupRequest {
  id: string;
  requesterId: string;
  name?: string;
  description?: string;
}

@Injectable()
export class UpdateGroupUseCase {
  constructor(
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
  ) {}

  async execute(request: UpdateGroupRequest): Promise<StudyGroup> {
    const group = await this.studyGroupRepository.findById(request.id);
    if (!group) throw new Error('Study group not found');
    if (group.ownerId !== request.requesterId) throw new Error('Forbidden');

    if (request.name !== undefined) group.name = request.name;
    if (request.description !== undefined) group.description = request.description;

    const updated = await this.studyGroupRepository.update(group);
    return updated;
  }
}

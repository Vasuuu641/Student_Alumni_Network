import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import { StudyGroup } from '../../domain/entities/study-group.entity';
import { GroupPolicyService } from '../policies/group-policy.service';

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
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: UpdateGroupRequest): Promise<StudyGroup> {
    const group = await this.studyGroupRepository.findById(request.id);
    if (!group) throw new Error('Study group not found');

    await this.policy.requireGroupOwner(group, request.requesterId);

    if (request.name !== undefined) group.name = request.name;
    if (request.description !== undefined) group.description = request.description;

    const updated = await this.studyGroupRepository.update(group);
    return updated;
  }
}

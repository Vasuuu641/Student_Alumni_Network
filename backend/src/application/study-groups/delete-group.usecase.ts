import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import { studyGroupStatus } from '../../domain/entities/study-group.entity';
import { GroupPolicyService } from '../policies/group-policy.service';

export interface DeleteGroupRequest {
  id: string;
  requesterId: string;
}

@Injectable()
export class DeleteGroupUseCase {
  constructor(
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: DeleteGroupRequest) {
    const group = await this.studyGroupRepository.findById(request.id);
    if (!group) {
      throw new Error('Study group not found');
    }

    await this.policy.requireGroupOwner(group, request.requesterId);

    return this.studyGroupRepository.updateStatus(request.id, studyGroupStatus.DELETED);
  }
}

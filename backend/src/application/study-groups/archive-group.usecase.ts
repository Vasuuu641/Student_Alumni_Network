import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import { studyGroupStatus } from '../../domain/entities/study-group.entity';
import { GroupPolicyService } from '../policies/group-policy.service';

export interface ArchiveGroupRequest {
  id: string;
  requesterId: string;
}

@Injectable()
export class ArchiveGroupUseCase {
  constructor(
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: ArchiveGroupRequest) {
    const group = await this.studyGroupRepository.findById(request.id);
    if (!group) throw new Error('Study group not found');

    await this.policy.requireGroupOwner(group, request.requesterId);

    const updated = await this.studyGroupRepository.updateStatus(request.id, studyGroupStatus.ARCHIVE);
    return updated;
  }
}

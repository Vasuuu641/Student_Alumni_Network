import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { StudyGroupUserArchiveRepository } from '../../domain/repositories/study-group-user-archive.repository';
import { studyGroupStatus } from '../../domain/entities/study-group.entity';
import { GroupPolicyService } from '../policies/group-policy.service';

export interface UnarchiveGroupRequest {
  id: string;
  requesterId: string;
}

@Injectable()
export class UnarchiveGroupUseCase {
  constructor(
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    @Inject('StudyGroupUserArchiveRepository')
    private readonly archiveRepository: StudyGroupUserArchiveRepository,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: UnarchiveGroupRequest) {
    const group = await this.studyGroupRepository.findById(request.id);
    if (!group || group.status !== studyGroupStatus.ACTIVE) {
      throw new Error('Study group not found');
    }

    await this.policy.requireGroupMember(request.id, request.requesterId);
    await this.archiveRepository.unarchiveForUser(request.id, request.requesterId);

    return { archived: false as const };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { GroupPolicyService } from '../policies/group-policy.service';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type {
  StudyGroupJoinRequestRepository,
  StudyGroupJoinRequestView,
} from '../../domain/repositories/study-group-join-request.repository';

@Injectable()
export class ListJoinRequestsUseCase {
  constructor(
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    @Inject('StudyGroupJoinRequestRepository')
    private readonly joinRequestRepository: StudyGroupJoinRequestRepository,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(input: { studyGroupId: string; requesterId: string }): Promise<StudyGroupJoinRequestView[]> {
    const group = await this.studyGroupRepository.findById(input.studyGroupId);
    if (!group) {
      throw new Error('Study group not found');
    }

    await this.policy.requireGroupOwner(group as any, input.requesterId);

    return this.joinRequestRepository.listPendingByGroupId(input.studyGroupId);
  }
}

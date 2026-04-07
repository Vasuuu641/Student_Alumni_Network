import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import { GroupPolicyService } from '../policies/group-policy.service';

export interface RemoveMemberRequest {
  studyGroupId: string;
  requesterId: string;
  userId: string;
}

@Injectable()
export class RemoveMemberUseCase {
  constructor(
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: RemoveMemberRequest) {
    const group = await this.studyGroupRepository.findById(request.studyGroupId);
    try {
      await this.policy.requireGroupOwner(group as any, request.requesterId);
    } catch (err) {
      await this.policy.requireGroupModerator(request.studyGroupId, request.requesterId);
    }
    await this.memberRepository.removeMember(request.studyGroupId, request.userId);
  }
}

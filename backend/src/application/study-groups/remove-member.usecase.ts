import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
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
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: RemoveMemberRequest) {
    await this.policy.requireGroupModerator(request.studyGroupId, request.requesterId);
    await this.memberRepository.removeMember(request.studyGroupId, request.userId);
  }
}

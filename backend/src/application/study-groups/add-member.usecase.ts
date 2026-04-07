import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import { studyGroupMemberRole } from '../../domain/entities/study-group.entity';
import { GroupPolicyService } from '../policies/group-policy.service';

export interface AddMemberRequest {
  studyGroupId: string;
  requesterId: string;
  userId: string;
  role?: studyGroupMemberRole;
}

@Injectable()
export class AddMemberUseCase {
  constructor(
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: AddMemberRequest): Promise<void> {
    const { studyGroupId, requesterId, userId, role = studyGroupMemberRole.MEMBER } = request;

    // only moderators or owners may add members
    await this.policy.requireGroupModerator(studyGroupId, requesterId);

    await this.memberRepository.addMember(studyGroupId, userId, role);
  }
}

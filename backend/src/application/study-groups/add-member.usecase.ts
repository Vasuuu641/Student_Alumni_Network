import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
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
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: AddMemberRequest): Promise<void> {
    const { studyGroupId, requesterId, userId, role = studyGroupMemberRole.MEMBER } = request;

    // allow owner OR moderators to add members
    const group = await this.studyGroupRepository.findById(studyGroupId);
    try {
      await this.policy.requireGroupOwner(group as any, requesterId);
    } catch (err) {
      await this.policy.requireGroupModerator(studyGroupId, requesterId);
    }

    await this.memberRepository.addMember(studyGroupId, userId, role);
  }
}

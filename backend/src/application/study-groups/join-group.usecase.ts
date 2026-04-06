import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import { studyGroupsVisibility, studyGroupMemberRole } from '../../domain/entities/study-group.entity';

export interface JoinGroupRequest {
  studyGroupId: string;
  userId: string;
  role?: studyGroupMemberRole;
}

@Injectable()
export class JoinGroupUseCase {
  constructor(
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
  ) {}

  async execute(request: JoinGroupRequest): Promise<void> {
    const { studyGroupId, userId, role = studyGroupMemberRole.MEMBER } = request;

    const group = await this.studyGroupRepository.findById(studyGroupId);
    if (!group) {
      throw new Error('Study group not found');
    }

    // V1 policy: private groups are invite-only
    if (group.visibility === studyGroupsVisibility.PRIVATE) {
      throw new Error('Cannot join private group without an invite');
    }

    // Attempt to add member; repository should enforce uniqueness.
    try {
      await this.memberRepository.addMember(studyGroupId, userId, role);
    } catch (err: any) {
      // If already a member, treat as idempotent; otherwise rethrow
      const msg = err?.message ?? '';
      if (msg.includes('Unique') || msg.includes('unique') || msg.includes('already exists')) {
        return;
      }
      throw err;
    }
  }
}

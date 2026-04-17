import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import { studyGroupMemberRole, studyGroupStatus } from '../../domain/entities/study-group.entity';
import { StudyGroup } from '../../domain/entities/study-group.entity';
import { studyGroupJoinStatus } from '../../domain/entities/study-group.entity';

@Injectable()
export class GroupPolicyService {
  constructor(
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
    @Inject('StudyGroupRepository')
    private readonly groupRepository: StudyGroupRepository,
  ) {}

  async requireGroupOwner(group: StudyGroup, requesterId: string, allowAdmin = false) {
    if (group.status !== studyGroupStatus.ACTIVE) {
      throw new Error('Study group not found');
    }

    if (group.ownerId === requesterId) return;
    if (allowAdmin) return; // admin handling left to caller (pass allowAdmin=true when controller knows requester is admin)
    throw new Error('Forbidden');
  }

  async requireGroupMember(groupId: string, userId: string) {
    const group = await this.groupRepository.findById(groupId);
    if (!group || group.status !== studyGroupStatus.ACTIVE) {
      throw new Error('Study group not found');
    }

    if (group.ownerId === userId) return;

    const members = await this.memberRepository.findByStudyGroupId(groupId);
    const found = members.find(
      (m) => m.userId === userId && m.joinStatus === studyGroupJoinStatus.ACTIVE,
    );
    if (found) return;

    throw new Error('Forbidden');
  }

  async requireGroupModerator(groupId: string, userId: string) {
    const group = await this.groupRepository.findById(groupId);
    if (!group || group.status !== studyGroupStatus.ACTIVE) {
      throw new Error('Study group not found');
    }

    const members = await this.memberRepository.findByStudyGroupId(groupId);
    const found = members.find((m) => m.userId === userId);
    if (!found) throw new Error('Forbidden');
    if (found.role === studyGroupMemberRole.OWNER || found.role === studyGroupMemberRole.MODERATOR) return;
    throw new Error('Forbidden');
  }
}

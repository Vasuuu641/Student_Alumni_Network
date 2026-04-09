import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import { studyGroupMemberRole } from '../../domain/entities/study-group.entity';
import { StudyGroup } from '../../domain/entities/study-group.entity';

@Injectable()
export class GroupPolicyService {
  constructor(
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
  ) {}

  async requireGroupOwner(group: StudyGroup, requesterId: string, allowAdmin = false) {
    if (group.ownerId === requesterId) return;
    if (allowAdmin) return; // admin handling left to caller (pass allowAdmin=true when controller knows requester is admin)
    throw new Error('Forbidden');
  }

  async requireGroupMember(groupId: string, userId: string) {
    const members = await this.memberRepository.findByStudyGroupId(groupId);
    const found = members.find((m) => m.userId === userId && m.joinStatus !== undefined);
    if (found && found.joinStatus !== undefined) return;
    // simpler check: presence is enough (repository returns joinStatus enum)
    const exists = members.some((m) => m.userId === userId && m.joinStatus !== undefined);
    if (exists) return;
    throw new Error('Forbidden');
  }

  async requireGroupModerator(groupId: string, userId: string) {
    const members = await this.memberRepository.findByStudyGroupId(groupId);
    const found = members.find((m) => m.userId === userId);
    if (!found) throw new Error('Forbidden');
    if (found.role === studyGroupMemberRole.OWNER || found.role === studyGroupMemberRole.MODERATOR) return;
    throw new Error('Forbidden');
  }
}

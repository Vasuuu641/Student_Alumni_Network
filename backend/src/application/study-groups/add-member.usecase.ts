import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';
import { studyGroupMemberRole } from '../../domain/entities/study-group.entity';
import { Email } from '../../domain/value-objects/email.vo';
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
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('StudyGroupsRealtimePublisher')
    private readonly realtimePublisher: StudyGroupsRealtimePublisher,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: AddMemberRequest): Promise<void> {
    const { studyGroupId, requesterId, userId, role = studyGroupMemberRole.MEMBER } = request;
    const targetIdentifier = userId.trim();

    // allow owner OR moderators to add members
    const group = await this.studyGroupRepository.findById(studyGroupId);
    if (!group) {
      throw new Error('Study group not found');
    }

    const targetUser = await this.resolveUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      throw new Error('User not found');
    }

    try {
      await this.policy.requireGroupOwner(group as any, requesterId);
    } catch (err) {
      await this.policy.requireGroupModerator(studyGroupId, requesterId);
    }

    await this.memberRepository.addMember(studyGroupId, targetUser.id, role);

    // Broadcast member joined to group
    const first = targetUser.firstName?.trim() ?? '';
    const last = targetUser.lastName?.trim() ?? '';
    const displayName = `${first} ${last}`.trim() || targetUser.email?.getValue() || targetUser.id;

    this.realtimePublisher.broadcastMemberJoined(studyGroupId, {
      userId: targetUser.id,
      displayName,
      email: targetUser.email?.getValue() || '',
      role: studyGroupMemberRole[role],
    });
  }

  private async resolveUserByIdentifier(identifier: string) {
    if (identifier.includes('@')) {
      try {
        return await this.userRepository.findByEmail(new Email(identifier));
      } catch {
        return null;
      }
    }

    return this.userRepository.findById(identifier);
  }
}

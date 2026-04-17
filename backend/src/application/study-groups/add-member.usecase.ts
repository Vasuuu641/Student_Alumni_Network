import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { StudyGroupInviteRepository } from '../../domain/repositories/study-group-invite.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';
import { studyGroupMemberRole, studyGroupsVisibility } from '../../domain/entities/study-group.entity';
import { Email } from '../../domain/value-objects/email.vo';
import { GroupPolicyService } from '../policies/group-policy.service';
import { randomUUID } from 'crypto';

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
    @Inject('StudyGroupInviteRepository')
    private readonly inviteRepository: StudyGroupInviteRepository,
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('StudyGroupsRealtimePublisher')
    private readonly realtimePublisher: StudyGroupsRealtimePublisher,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: AddMemberRequest): Promise<{ status: 'ADDED' | 'INVITED'; inviteId?: string; expiresAt?: Date }> {
    const { studyGroupId, requesterId, userId } = request;
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

    const existingMember = (await this.memberRepository.findByStudyGroupId(studyGroupId)).find(
      (member) => member.userId === targetUser.id,
    );
    if (existingMember) {
      throw new Error('User is already a member of this group');
    }

    // For private groups, owner/moderator-added users should join immediately without invite acceptance.
    if (group.visibility === studyGroupsVisibility.PRIVATE) {
      await this.memberRepository.addMember(studyGroupId, targetUser.id, studyGroupMemberRole.MEMBER);

      const displayName =
        `${targetUser.firstName?.trim?.() ?? ''} ${targetUser.lastName?.trim?.() ?? ''}`.trim() ||
        targetUser.email?.getValue?.() ||
        targetUser.id;
      const email = targetUser.email?.getValue?.() ?? '';

      this.realtimePublisher.broadcastMemberJoined(studyGroupId, {
        userId: targetUser.id,
        displayName,
        email,
        role: 'MEMBER',
      });

      const existingPendingInvite = await this.inviteRepository.findActivePendingInvite(
        studyGroupId,
        targetUser.id,
        new Date(),
      );

      if (existingPendingInvite) {
        await this.inviteRepository.delete(existingPendingInvite.id);
      }

      return { status: 'ADDED' };
    }

    const inviteToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const existingPendingInvite = await this.inviteRepository.findActivePendingInvite(
      studyGroupId,
      targetUser.id,
      new Date(),
    );

    if (existingPendingInvite) {
      return {
        status: 'INVITED',
        inviteId: existingPendingInvite.id,
        expiresAt: existingPendingInvite.expiresAt,
      };
    }

    const createdInvite = await this.inviteRepository.create({
      groupId: studyGroupId,
      invitedUserId: targetUser.id,
      invitedBy: requesterId,
      token: inviteToken,
      expiresAt,
    });

    this.realtimePublisher.broadcastInviteCreated(studyGroupId, {
      inviteId: createdInvite.id,
      groupId: studyGroupId,
      invitedBy: requesterId,
      invitedUserId: targetUser.id,
      expiresAt: expiresAt.toISOString(),
    });

    return { status: 'INVITED', inviteId: createdInvite.id, expiresAt };
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

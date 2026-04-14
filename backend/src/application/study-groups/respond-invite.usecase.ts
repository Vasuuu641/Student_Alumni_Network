import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { StudyGroupInviteRepository } from '../../domain/repositories/study-group-invite.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';
import { studyGroupMemberRole } from '../../domain/entities/study-group.entity';

export type InviteDecision = 'ACCEPT' | 'DECLINE';

@Injectable()
export class RespondInviteUseCase {
  constructor(
    @Inject('StudyGroupInviteRepository')
    private readonly inviteRepository: StudyGroupInviteRepository,
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('StudyGroupsRealtimePublisher')
    private readonly realtimePublisher: StudyGroupsRealtimePublisher,
  ) {}

  async execute(input: { inviteId: string; userId: string; decision: InviteDecision }) {
    const invite = await this.inviteRepository.findById(input.inviteId);

    if (!invite) {
      throw new Error('Invite not found');
    }

    if (invite.invitedUserId !== input.userId) {
      throw new Error('Forbidden');
    }

    if (invite.acceptedAt) {
      return { status: 'ALREADY_ACCEPTED' as const };
    }

    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      throw new Error('Invite expired');
    }

    if (input.decision === 'DECLINE') {
      await this.inviteRepository.delete(invite.id);
      return { status: 'DECLINED' as const };
    }

    const existingMember = (await this.memberRepository.findByStudyGroupId(invite.groupId)).find(
      (member) => member.userId === input.userId,
    );

    if (!existingMember) {
      await this.memberRepository.addMember(invite.groupId, input.userId, studyGroupMemberRole.MEMBER);
    }

    await this.inviteRepository.markAccepted(invite.id, new Date());

    const user = await this.userRepository.findById(input.userId);
    const displayName = user
      ? `${user.firstName?.trim() ?? ''} ${user.lastName?.trim() ?? ''}`.trim() || user.email.getValue()
      : input.userId;
    const email = user?.email.getValue() ?? '';

    this.realtimePublisher.broadcastMemberJoined(invite.groupId, {
      userId: input.userId,
      displayName,
      email,
      role: 'MEMBER',
    });

    return { status: 'ACCEPTED' as const, groupId: invite.groupId };
  }
}

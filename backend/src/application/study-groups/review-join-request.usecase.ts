import { Inject, Injectable } from '@nestjs/common';
import { GroupPolicyService } from '../policies/group-policy.service';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { StudyGroupJoinRequestRepository } from '../../domain/repositories/study-group-join-request.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';
import { studyGroupMemberRole, studyGroupStatus } from '../../domain/entities/study-group.entity';

export type JoinRequestDecision = 'APPROVE' | 'DECLINE';

@Injectable()
export class ReviewJoinRequestUseCase {
  constructor(
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    @Inject('StudyGroupJoinRequestRepository')
    private readonly joinRequestRepository: StudyGroupJoinRequestRepository,
    private readonly policy: GroupPolicyService,
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('StudyGroupsRealtimePublisher')
    private readonly realtimePublisher: StudyGroupsRealtimePublisher,
  ) {}

  async execute(input: {
    studyGroupId: string;
    joinRequestId: string;
    requesterId: string;
    decision: JoinRequestDecision;
  }) {
    const group = await this.studyGroupRepository.findById(input.studyGroupId);
    if (!group || group.status !== studyGroupStatus.ACTIVE) {
      throw new Error('Study group not found');
    }

    await this.policy.requireGroupOwner(group as any, input.requesterId);

    const joinRequest = await this.joinRequestRepository.findById(input.joinRequestId);

    if (!joinRequest || joinRequest.groupId !== input.studyGroupId) {
      throw new Error('Join request not found');
    }

    if (joinRequest.status !== 'PENDING') {
      return { status: joinRequest.status };
    }

    if (input.decision === 'DECLINE') {
      await this.joinRequestRepository.updateStatus(joinRequest.id, 'DECLINED');
      this.realtimePublisher.broadcastJoinRequestUpdated(input.studyGroupId, {
        requestId: joinRequest.id,
        groupId: input.studyGroupId,
        requesterUserId: joinRequest.userId,
        status: 'DECLINED',
      });
      return { status: 'DECLINED' as const };
    }

    const existingMember = (await this.memberRepository.findByStudyGroupId(input.studyGroupId)).find(
      (member) => member.userId === joinRequest.userId,
    );

    if (!existingMember) {
      await this.memberRepository.addMember(input.studyGroupId, joinRequest.userId, studyGroupMemberRole.MEMBER);
    }

    await this.joinRequestRepository.updateStatus(joinRequest.id, 'ACCEPTED');

    const user = await this.userRepository.findById(joinRequest.userId);
    const displayName = user
      ? `${user.firstName?.trim() ?? ''} ${user.lastName?.trim() ?? ''}`.trim() || user.email.getValue()
      : joinRequest.userId;
    const email = user?.email.getValue() ?? '';

    this.realtimePublisher.broadcastMemberJoined(input.studyGroupId, {
      userId: joinRequest.userId,
      displayName,
      email,
      role: 'MEMBER',
    });

    this.realtimePublisher.broadcastJoinRequestUpdated(input.studyGroupId, {
      requestId: joinRequest.id,
      groupId: input.studyGroupId,
      requesterUserId: joinRequest.userId,
      status: 'ACCEPTED',
    });

    return { status: 'ACCEPTED' as const, userId: joinRequest.userId };
  }
}

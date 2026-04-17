import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';
import { GroupPolicyService } from '../policies/group-policy.service';
import { studyGroupStatus } from '../../domain/entities/study-group.entity';

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
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    @Inject('StudyGroupsRealtimePublisher')
    private readonly realtimePublisher: StudyGroupsRealtimePublisher,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: RemoveMemberRequest) {
    const group = await this.studyGroupRepository.findById(request.studyGroupId);
    if (!group || group.status !== studyGroupStatus.ACTIVE) {
      throw new Error('Study group not found');
    }

    try {
      await this.policy.requireGroupOwner(group as any, request.requesterId);
    } catch (err) {
      await this.policy.requireGroupModerator(request.studyGroupId, request.requesterId);
    }
    await this.memberRepository.removeMember(request.studyGroupId, request.userId);

    // Broadcast member left to group
    this.realtimePublisher.broadcastMemberLeft(request.studyGroupId, request.userId);
  }
}

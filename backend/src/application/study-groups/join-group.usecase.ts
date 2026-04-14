import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { StudyGroupJoinRequestRepository } from '../../domain/repositories/study-group-join-request.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';
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
    @Inject('StudyGroupJoinRequestRepository')
    private readonly joinRequestRepository: StudyGroupJoinRequestRepository,
    @Inject('StudyGroupsRealtimePublisher')
    private readonly realtimePublisher: StudyGroupsRealtimePublisher,
  ) {}

  async execute(request: JoinGroupRequest): Promise<{ requestId: string; status: 'PENDING' | 'ALREADY_MEMBER' }> {
    const { studyGroupId, userId } = request;

    const group = await this.studyGroupRepository.findById(studyGroupId);
    if (!group) {
      throw new Error('Study group not found');
    }

    // Private groups are invite-only
    if (group.visibility === studyGroupsVisibility.PRIVATE) {
      throw new Error('Cannot join private group without an invite');
    }

    const existingMember = (await this.memberRepository.findByStudyGroupId(studyGroupId)).find(
      (member) => member.userId === userId,
    );
    if (existingMember) {
      return { requestId: '', status: 'ALREADY_MEMBER' };
    }

    const existingPending = await this.joinRequestRepository.findPendingByGroupAndUser(studyGroupId, userId);

    if (existingPending) {
      return { requestId: existingPending.id, status: 'PENDING' };
    }

    const createdRequest = await this.joinRequestRepository.createPending(studyGroupId, userId);

    this.realtimePublisher.broadcastJoinRequestUpdated(studyGroupId, {
      requestId: createdRequest.id,
      groupId: studyGroupId,
      requesterUserId: userId,
      status: 'PENDING',
    });

    return { requestId: createdRequest.id, status: 'PENDING' };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';
import { studyGroupMemberRole } from '../../domain/entities/study-group.entity';
import { GroupPolicyService } from '../policies/group-policy.service';

export interface UpdateMemberRoleRequest {
  studyGroupId: string;
  requesterId: string;
  userId: string;
  role: studyGroupMemberRole;
}

@Injectable()
export class UpdateMemberRoleUseCase {
  constructor(
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    @Inject('StudyGroupsRealtimePublisher')
    private readonly realtimePublisher: StudyGroupsRealtimePublisher,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: UpdateMemberRoleRequest) {
    const group = await this.studyGroupRepository.findById(request.studyGroupId);
    try {
      await this.policy.requireGroupOwner(group as any, request.requesterId);
    } catch (err) {
      await this.policy.requireGroupModerator(request.studyGroupId, request.requesterId);
    }

    await this.memberRepository.updateMemberRole(request.studyGroupId, request.userId, request.role);

    // Broadcast role update to group
    this.realtimePublisher.broadcastMemberRoleUpdated(
      request.studyGroupId,
      request.userId,
      studyGroupMemberRole[request.role],
    );
  }
}

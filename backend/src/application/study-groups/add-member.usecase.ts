import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';
import { studyGroupMemberRole } from '../../domain/entities/study-group.entity';
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

    // allow owner OR moderators to add members
    const group = await this.studyGroupRepository.findById(studyGroupId);
    try {
      await this.policy.requireGroupOwner(group as any, requesterId);
    } catch (err) {
      await this.policy.requireGroupModerator(studyGroupId, requesterId);
    }

    await this.memberRepository.addMember(studyGroupId, userId, role);

    // Broadcast member joined to group
    const user = await this.userRepository.findById(userId);
    const first = user?.firstName?.trim() ?? '';
    const last = user?.lastName?.trim() ?? '';
    const displayName = `${first} ${last}`.trim() || user?.email?.getValue() || userId;

    this.realtimePublisher.broadcastMemberJoined(studyGroupId, {
      userId,
      displayName,
      email: user?.email?.getValue() || '',
      role: studyGroupMemberRole[role],
    });
  }
}

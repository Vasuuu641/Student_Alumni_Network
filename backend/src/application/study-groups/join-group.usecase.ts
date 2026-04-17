import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';
import { studyGroupsVisibility, studyGroupMemberRole, studyGroupStatus } from '../../domain/entities/study-group.entity';

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
    @Inject('StudyGroupsRealtimePublisher')
    private readonly realtimePublisher: StudyGroupsRealtimePublisher,
  ) {}

  async execute(request: JoinGroupRequest): Promise<{ requestId: string; status: 'JOINED' | 'ALREADY_MEMBER' }> {
    const { studyGroupId, userId } = request;

    const group = await this.studyGroupRepository.findById(studyGroupId);
    if (!group || group.status !== studyGroupStatus.ACTIVE) {
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

    await this.memberRepository.addMember(studyGroupId, userId, studyGroupMemberRole.MEMBER);

    this.realtimePublisher.broadcastMemberJoined(studyGroupId, {
      userId,
      displayName: userId,
      email: '',
      role: 'MEMBER',
    });

    return { requestId: '', status: 'JOINED' };
  }
}

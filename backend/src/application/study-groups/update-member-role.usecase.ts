import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
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
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: UpdateMemberRoleRequest) {
    await this.policy.requireGroupModerator(request.studyGroupId, request.requesterId);
    await this.memberRepository.updateMemberRole(request.studyGroupId, request.userId, request.role);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import { studyGroupMemberRole } from '../../domain/entities/study-group.entity';

export interface UpdateMemberRoleRequest {
  studyGroupId: string;
  userId: string;
  role: studyGroupMemberRole;
}

@Injectable()
export class UpdateMemberRoleUseCase {
  constructor(
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
  ) {}

  async execute(request: UpdateMemberRoleRequest) {
    await this.memberRepository.updateMemberRole(request.studyGroupId, request.userId, request.role);
  }
}

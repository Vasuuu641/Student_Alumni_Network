import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';

export interface LeaveGroupRequest {
  studyGroupId: string;
  userId: string;
}

@Injectable()
export class LeaveGroupUseCase {
  constructor(
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
  ) {}

  async execute(request: LeaveGroupRequest) {
    await this.memberRepository.removeMember(request.studyGroupId, request.userId);
  }
}

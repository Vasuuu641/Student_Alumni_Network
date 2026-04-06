import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';

export interface RemoveMemberRequest {
  studyGroupId: string;
  userId: string;
}

@Injectable()
export class RemoveMemberUseCase {
  constructor(
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
  ) {}

  async execute(request: RemoveMemberRequest) {
    await this.memberRepository.removeMember(request.studyGroupId, request.userId);
  }
}

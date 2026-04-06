import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';

export interface ListMembersRequest {
  studyGroupId: string;
}

@Injectable()
export class ListMembersUseCase {
  constructor(
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
  ) {}

  async execute(request: ListMembersRequest) {
    return this.memberRepository.findByStudyGroupId(request.studyGroupId);
  }
}

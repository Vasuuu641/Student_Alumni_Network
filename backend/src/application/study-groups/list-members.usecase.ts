import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupMemberRepository } from '../../domain/repositories/study-group-member.repository';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import { studyGroupStatus } from '../../domain/entities/study-group.entity';

export interface ListMembersRequest {
  studyGroupId: string;
}

@Injectable()
export class ListMembersUseCase {
  constructor(
    @Inject('StudyGroupMemberRepository')
    private readonly memberRepository: StudyGroupMemberRepository,
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
  ) {}

  async execute(request: ListMembersRequest) {
    const group = await this.studyGroupRepository.findById(request.studyGroupId);
    if (!group || group.status !== studyGroupStatus.ACTIVE) {
      throw new Error('Study group not found');
    }

    return this.memberRepository.findByStudyGroupId(request.studyGroupId);
  }
}

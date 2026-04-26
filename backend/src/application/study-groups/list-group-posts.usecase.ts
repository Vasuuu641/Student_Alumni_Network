import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupPostRepository } from '../../domain/repositories/study-group-post.repository';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import { studyGroupStatus } from '../../domain/entities/study-group.entity';
import { GroupPolicyService } from '../policies/group-policy.service';

export interface ListGroupPostsRequest {
  studyGroupId: string;
  requesterId: string;
}

@Injectable()
export class ListGroupPostsUseCase {
  constructor(
    @Inject('StudyGroupPostRepository')
    private readonly postRepository: StudyGroupPostRepository,
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: ListGroupPostsRequest) {
    const group = await this.studyGroupRepository.findById(request.studyGroupId);
    if (!group || group.status !== studyGroupStatus.ACTIVE) {
      throw new Error('Study group not found');
    }

    await this.policy.requireGroupMember(request.studyGroupId, request.requesterId);

    return this.postRepository.findByStudyGroupId(request.studyGroupId);
  }
}

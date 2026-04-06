import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupPostRepository } from '../../domain/repositories/study-group-post.repository';
import { GroupPolicyService } from '../policies/group-policy.service';

export interface CreateGroupPostRequest {
  studyGroupId: string;
  authorId: string;
  content: string;
}

@Injectable()
export class CreateGroupPostUseCase {
  constructor(
    @Inject('StudyGroupPostRepository')
    private readonly postRepository: StudyGroupPostRepository,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: CreateGroupPostRequest) {
    await this.policy.requireGroupMember(request.studyGroupId, request.authorId);
    return this.postRepository.create({ studyGroupId: request.studyGroupId, authorId: request.authorId, content: request.content });
  }
}

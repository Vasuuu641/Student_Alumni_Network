import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupPostRepository } from '../../domain/repositories/study-group-post.repository';

export interface ListGroupPostsRequest {
  studyGroupId: string;
}

@Injectable()
export class ListGroupPostsUseCase {
  constructor(
    @Inject('StudyGroupPostRepository')
    private readonly postRepository: StudyGroupPostRepository,
  ) {}

  async execute(request: ListGroupPostsRequest) {
    return this.postRepository.findByStudyGroupId(request.studyGroupId);
  }
}

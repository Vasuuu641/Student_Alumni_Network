import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupPostRepository } from '../../domain/repositories/study-group-post.repository';

export interface EditGroupPostRequest {
  postId: string;
  content: string;
}

@Injectable()
export class EditGroupPostUseCase {
  constructor(
    @Inject('StudyGroupPostRepository')
    private readonly postRepository: StudyGroupPostRepository,
  ) {}

  async execute(request: EditGroupPostRequest) {
    return this.postRepository.update(request.postId, request.content);
  }
}

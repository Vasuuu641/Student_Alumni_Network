import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupPostRepository } from '../../domain/repositories/study-group-post.repository';

export interface DeleteGroupPostRequest {
  postId: string;
}

@Injectable()
export class DeleteGroupPostUseCase {
  constructor(
    @Inject('StudyGroupPostRepository')
    private readonly postRepository: StudyGroupPostRepository,
  ) {}

  async execute(request: DeleteGroupPostRequest) {
    await this.postRepository.delete(request.postId);
  }
}

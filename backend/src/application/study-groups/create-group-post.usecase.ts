import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupPostRepository } from '../../domain/repositories/study-group-post.repository';

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
  ) {}

  async execute(request: CreateGroupPostRequest) {
    return this.postRepository.create({ studyGroupId: request.studyGroupId, authorId: request.authorId, content: request.content });
  }
}

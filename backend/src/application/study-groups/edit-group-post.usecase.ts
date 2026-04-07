import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupPostRepository } from '../../domain/repositories/study-group-post.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';

export interface EditGroupPostRequest {
  postId: string;
  content: string;
}

@Injectable()
export class EditGroupPostUseCase {
  constructor(
    @Inject('StudyGroupPostRepository')
    private readonly postRepository: StudyGroupPostRepository,
    @Inject('StudyGroupsRealtimePublisher')
    private readonly realtimePublisher: StudyGroupsRealtimePublisher,
  ) {}

  async execute(request: EditGroupPostRequest) {
    const updated = await this.postRepository.update(request.postId, request.content);
    
    // Broadcast post edit to group members
    this.realtimePublisher.broadcastPostEdited(
      updated.studyGroupId,
      updated.id,
      updated.content,
      new Date().toISOString(),
    );

    return updated;
  }
}


import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupPostRepository } from '../../domain/repositories/study-group-post.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';

export interface DeleteGroupPostRequest {
  postId: string;
}

@Injectable()
export class DeleteGroupPostUseCase {
  constructor(
    @Inject('StudyGroupPostRepository')
    private readonly postRepository: StudyGroupPostRepository,
    @Inject('StudyGroupsRealtimePublisher')
    private readonly realtimePublisher: StudyGroupsRealtimePublisher,
  ) {}

  async execute(request: DeleteGroupPostRequest) {
    const deleted = await this.postRepository.delete(request.postId);
    
    // Broadcast post deletion to group members
    this.realtimePublisher.broadcastPostDeleted(deleted.groupId, deleted.id);
  }
}


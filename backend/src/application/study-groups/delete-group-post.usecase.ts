import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupPostRepository } from '../../domain/repositories/study-group-post.repository';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';
import { studyGroupStatus } from '../../domain/entities/study-group.entity';

export interface DeleteGroupPostRequest {
  postId: string;
}

@Injectable()
export class DeleteGroupPostUseCase {
  constructor(
    @Inject('StudyGroupPostRepository')
    private readonly postRepository: StudyGroupPostRepository,
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    @Inject('StudyGroupsRealtimePublisher')
    private readonly realtimePublisher: StudyGroupsRealtimePublisher,
  ) {}

  async execute(request: DeleteGroupPostRequest) {
    const existing = await this.postRepository.findById(request.postId);
    if (!existing) {
      throw new Error('Post not found');
    }

    const group = await this.studyGroupRepository.findById(existing.studyGroupId);
    if (!group || group.status !== studyGroupStatus.ACTIVE) {
      throw new Error('Study group not found');
    }

    const deleted = await this.postRepository.delete(request.postId);
    
    // Broadcast post deletion to group members
    this.realtimePublisher.broadcastPostDeleted(deleted.groupId, deleted.id);
  }
}


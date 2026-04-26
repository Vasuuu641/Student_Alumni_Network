import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupPostRepository } from '../../domain/repositories/study-group-post.repository';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';
import { studyGroupStatus } from '../../domain/entities/study-group.entity';

export interface EditGroupPostRequest {
  postId: string;
  content: string;
}

@Injectable()
export class EditGroupPostUseCase {
  constructor(
    @Inject('StudyGroupPostRepository')
    private readonly postRepository: StudyGroupPostRepository,
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    @Inject('StudyGroupsRealtimePublisher')
    private readonly realtimePublisher: StudyGroupsRealtimePublisher,
  ) {}

  async execute(request: EditGroupPostRequest) {
    const existing = await this.postRepository.findById(request.postId);
    if (!existing) {
      throw new Error('Post not found');
    }

    const group = await this.studyGroupRepository.findById(existing.studyGroupId);
    if (!group || group.status !== studyGroupStatus.ACTIVE) {
      throw new Error('Study group not found');
    }

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


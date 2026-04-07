import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupPostRepository } from '../../domain/repositories/study-group-post.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';
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
    @Inject('StudyGroupsRealtimePublisher')
    private readonly realtimePublisher: StudyGroupsRealtimePublisher,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: CreateGroupPostRequest) {
    await this.policy.requireGroupMember(request.studyGroupId, request.authorId);
    const post = await this.postRepository.create({ studyGroupId: request.studyGroupId, authorId: request.authorId, content: request.content });
    
    // Broadcast post creation to group members
    this.realtimePublisher.broadcastPostCreated(request.studyGroupId, {
      id: post.id,
      groupId: post.studyGroupId,
      authorId: post.authorId,
      content: post.content,
      createdAt: new Date().toISOString(),
    });

    return post;
  }
}


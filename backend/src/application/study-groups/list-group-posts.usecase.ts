import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupPostRepository } from '../../domain/repositories/study-group-post.repository';
import type { StudyGroupRepository } from '../../domain/repositories/study-group.repository';
import type { StudyGroupPostAttachmentRepository } from '../../domain/repositories/study-group-post-attachment.repository';
import { studyGroupStatus, StudyGroupPostAttachment } from '../../domain/entities/study-group.entity';
import { GroupPolicyService } from '../policies/group-policy.service';

export interface ListGroupPostsRequest {
  studyGroupId: string;
  requesterId: string;
}

@Injectable()
export class ListGroupPostsUseCase {
  constructor(
    @Inject('StudyGroupPostRepository')
    private readonly postRepository: StudyGroupPostRepository,
    @Inject('StudyGroupRepository')
    private readonly studyGroupRepository: StudyGroupRepository,
    @Inject('StudyGroupPostAttachmentRepository')
    private readonly postAttachmentRepository: StudyGroupPostAttachmentRepository,
    private readonly policy: GroupPolicyService,
  ) {}

  async execute(request: ListGroupPostsRequest) {
    const group = await this.studyGroupRepository.findById(request.studyGroupId);
    if (!group || group.status !== studyGroupStatus.ACTIVE) {
      throw new Error('Study group not found');
    }

    await this.policy.requireGroupMember(request.studyGroupId, request.requesterId);

    const posts = await this.postRepository.findByStudyGroupId(request.studyGroupId);

    if (!posts.length) {
      return posts;
    }

    const attachmentsByPost = await Promise.all(
      posts.map((post) => this.postAttachmentRepository.findByPostId(post.id)),
    );

    return posts.map((post, index) =>
      Object.assign(post, { attachments: attachmentsByPost[index] as StudyGroupPostAttachment[] }),
    );
  }
}
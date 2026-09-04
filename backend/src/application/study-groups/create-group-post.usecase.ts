import { Inject, Injectable } from '@nestjs/common';
import type { StudyGroupPostRepository } from '../../domain/repositories/study-group-post.repository';
import type { StudyGroupsRealtimePublisher } from '../../domain/services/study-groups-realtime-publisher';
import type { FileStorageService, FileUploadRequest } from '../../domain/services/file-storage';
import { GROUP_POST_ATTACHMENT_UPLOAD_OPTIONS } from '../../shared/constants/upload_limits';
import { StudyGroupPostAttachment } from '../../domain/entities/study-group.entity'
import { GroupPolicyService } from '../policies/group-policy.service';
import { BadRequestException } from '@nestjs/common';

export interface CreateGroupPostRequest {
  studyGroupId: string;
  authorId: string;
  content: string;
  attachments?: FileUploadRequest[]; // Optional attachments
}

@Injectable()
export class CreateGroupPostUseCase {
  constructor(
    @Inject('StudyGroupPostRepository')
    private readonly postRepository: StudyGroupPostRepository,
    @Inject('StudyGroupsRealtimePublisher')
    private readonly realtimePublisher: StudyGroupsRealtimePublisher,
    private readonly policy: GroupPolicyService,
    @Inject('FileStorageService')
    private readonly fileStorageService: FileStorageService,
    @Inject('StudyGroupPostAttachmentRepository')
    private readonly attachmentRepository: any, // Use the correct type for your attachment repository
  ) {}

  async execute(request: CreateGroupPostRequest) {
    if (!request.content?.trim() && !request.attachments?.length) {
      throw new BadRequestException('Post must include text or at least one attachment');
    }

    await this.policy.requireGroupMember(request.studyGroupId, request.authorId);

    const post = await this.postRepository.create({
      studyGroupId: request.studyGroupId,
      authorId: request.authorId,
      content: request.content?.trim() ?? '',
    });

    let createdAttachments: StudyGroupPostAttachment[] = [];

    if (request.attachments?.length) {
      createdAttachments = await Promise.all(
        request.attachments.map(async (file) => {
          const fileUrl = await this.fileStorageService.uploadFile(
            'study-group-post',
            request.authorId,
            file,
            GROUP_POST_ATTACHMENT_UPLOAD_OPTIONS,
          );
          const key = fileUrl.substring(fileUrl.indexOf('/study-group-post/') + 1);
          return this.attachmentRepository.create({
            postId: post.id,
            key,
            url: fileUrl,
            mimeType: file.mimeType,
            size: file.size,
            uploadedById: request.authorId,
          });
        }),
      );
    }

    this.realtimePublisher.broadcastPostCreated(request.studyGroupId, {
      id: post.id,
      groupId: post.studyGroupId,
      authorId: post.authorId,
      content: post.content,
      createdAt: new Date().toISOString(),
    });

    return Object.assign(post, { attachments: createdAttachments });
  }
}

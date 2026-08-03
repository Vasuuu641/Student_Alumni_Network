import { Injectable, Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { ThreadRepository, ThreadReplyRepository } from 'src/domain/repositories/thread.repository';
import type {ThreadAttachmentRepository} from 'src/domain/repositories/threadAttachment.repository';
import type {FileStorageService, FileUploadRequest} from 'src/domain/services/file-storage';
import {THREAD_ATTACHMENT_UPLOAD_OPTIONS} from 'src/shared/constants/upload_limits';
import { ThreadReply, ReplyStatus } from 'src/domain/entities/thread.entity';
import { CreateNotificationUseCase } from '../notifications/create-notification.usecase';
import { NotificationType } from 'src/domain/entities/notification.entity';
import { NotificationEligibilityService } from 'src/infrastructure/services/notification-eligibility.service';
import { InterestSignalType } from 'src/domain/entities/user-interest.entity';
import type { UserInterestSignalRepository } from 'src/domain/repositories/user-interest.repository';
import { ThreadPanel } from 'src/domain/entities/thread.entity';
import { MentorClusteringService } from 'src/infrastructure/ai/cohere/mentor-clustering.service';
import { ThreadAttachment } from 'src/domain/entities/threadAttachment.entity';

@Injectable()
export class PostReplyUseCase {
  constructor(
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
    @Inject('ThreadReplyRepository') private readonly replyRepository: ThreadReplyRepository,
    @Inject('ThreadAttachmentRepository') private readonly threadAttachmentRepository: ThreadAttachmentRepository,
    @Inject('FileStorageService') private readonly fileStorageService: FileStorageService,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
    private readonly eligibilityService: NotificationEligibilityService,
    private readonly mentorClusteringService: MentorClusteringService,
    @Inject('UserInterestSignalRepository')
    private readonly signalRepository: UserInterestSignalRepository,
  ) {}

  async execute(
    threadId: string,
    userId: string,
    content: string,
    parentReplyId: string | null,
    attachments: FileUploadRequest[] = [],
  ): Promise<ThreadReply> {
    const thread = await this.threadRepository.findById(threadId);

    if (!content?.trim() && !attachments?.length) {
    throw new BadRequestException('Reply must include text or at least one attachment');
    }


    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    if (!thread.canAcceptReplies()) {
      throw new ForbiddenException('This thread is closed and not accepting new replies');
    }

    const now = new Date();

    const reply = await this.replyRepository.create({
      id: this.generateUniqueId(),
      threadId,
      content,
      authorId: userId,
      status: ReplyStatus.ACTIVE,
      editedAt: null,
      voteScore: 0,
      parentReplyId,
      createdAt: now,
      updatedAt: now,
      isAuthoredBy: (checkUserId: string) => userId === checkUserId,
      isDeleted: () => false,
    });

    let createdAttachments: ThreadAttachment[] = [];

    if (attachments?.length) {
      createdAttachments = await Promise.all(
        attachments.map(async (file) => {
          const file_url = await this.fileStorageService.uploadFile(
            'thread',
            userId,
            file,
            THREAD_ATTACHMENT_UPLOAD_OPTIONS,
          );
          const key = file_url.substring(file_url.indexOf('/thread/') + 1);
          return this.threadAttachmentRepository.create({
            threadId: null,
            replyId: reply.id,
            key,
            url: file_url,
            mimeType: file.mimeType,
            size: file.size,
            uploadedById: userId,
          });
        }),
      );
    }
    await this.threadRepository.incrementReplyCount(threadId);

    if (thread.authorId !== userId) {
      // Capture reply signal for the replier
      await this.eligibilityService.captureSignal(
        userId,
        InterestSignalType.THREAD_REPLY,
        'THREAD',
        thread.id,
        thread.panel,
        'threads',
      ).catch((error) => {
        console.error(`Failed to capture reply signal: ${error?.message ?? error}`);
      });

      await this.createNotificationUseCase.execute({
        userId: thread.authorId,
        type: NotificationType.THREAD_REPLY,
        title: `New reply on ${thread.title}`,
        body: 'A discussion you started has a new reply.',
        entityType: 'THREAD',
        entityId: thread.id,
        sourceModule: 'threads',
        actionUrl: `/threads/${thread.id}`,
        score: 1,
        dedupeKey: `thread-reply:${thread.id}:${reply.id}`,
        metadataJson: {
          threadId: thread.id,
          replyId: reply.id,
          actorId: userId,
          reason: 'thread reply activity',
        },
      }).catch((error) => {
        console.error(`Failed to create thread reply notification for ${thread.id}:`, error?.message ?? error);
      });

      if (thread.panel === ThreadPanel.ALUMNI) {
        const mentorMatches = await this.mentorClusteringService.findRelevantMentors({
          title: thread.title,
          description: content,
          panel: thread.panel,
          limit: 3,
          excludeUserIds: [userId],
        }).catch((error) => {
          console.error(`Mentor clustering failed for thread ${thread.id}: ${error?.message ?? error}`);
          return [];
        });

        await Promise.all(
          mentorMatches.map((match) =>
            this.createNotificationUseCase
              .execute({
                userId: match.userId,
                type: NotificationType.THREAD_ACTIVITY,
                title: `A reply matches your expertise`,
                body: `Someone replied in an alumni discussion that may need your input: ${thread.title}`,
                entityType: 'THREAD',
                entityId: thread.id,
                sourceModule: 'mentor-clustering',
                actionUrl: `/threads/${thread.id}`,
                score: match.score,
                dedupeKey: `mentor-thread-reply:${thread.id}:${reply.id}:${match.userId}`,
                metadataJson: {
                  matchReason: match.reason,
                  matchedSignals: match.matchedSignals,
                  panel: thread.panel,
                },
              })
              .catch((error) => {
                console.error(
                  `Failed to create mentor notification for reply ${reply.id}:`,
                  error?.message ?? error,
                );
              }),
          ),
        );
      }
    }

    return Object.assign(reply, { attachments: createdAttachments });
  }

  private generateUniqueId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}
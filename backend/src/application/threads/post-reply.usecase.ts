import { Injectable, Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ThreadRepository, ThreadReplyRepository } from 'src/domain/repositories/thread.repository';
import type { ThreadAttachmentRepository } from 'src/domain/repositories/threadAttachment.repository';
import type { FileStorageService, FileUploadRequest } from 'src/domain/services/file-storage';
import { THREAD_ATTACHMENT_UPLOAD_OPTIONS } from 'src/shared/constants/upload_limits';
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
    if (!content?.trim() && !attachments?.length) {
      throw new BadRequestException('Reply must include text or at least one attachment');
    }

    const thread = await this.threadRepository.findById(threadId);

    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    if (!thread.canAcceptReplies()) {
      throw new ForbiddenException('This thread is closed and not accepting new replies');
    }

    const now = new Date();

    const reply = await this.replyRepository.create({
      id: randomUUID(),
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

    // Always capture the replier's own interest signal — even for a
    // self-reply — since this is about their profile, not about who
    // gets notified. Notifications below stay self-exclusion-gated.
    await this.eligibilityService
      .captureSignal(userId, InterestSignalType.THREAD_REPLY, 'THREAD', thread.id, thread.panel, 'threads')
      .catch((error) => {
        console.error(`Failed to capture reply signal: ${error?.message ?? error}`);
      });

    if (thread.authorId !== userId) {
      await this.createNotificationUseCase
        .execute({
          userId: thread.authorId,
          type: NotificationType.THREAD_REPLY,
          title: `New reply on ${thread.title}`,
          body: 'A discussion you started has a new reply.',
          entityType: 'THREAD',
          entityId: thread.id,
          sourceModule: 'threads',
          actionUrl: `/threads/${thread.id}`,
          score: 1,
          // No reply.id here — stable per thread+recipient, so repeat
          // replies within the collapse window update this same
          // notification instead of spamming a new one each time.
          dedupeKey: `thread-reply:${thread.id}:${thread.authorId}`,
          collapsible: true,
          collapseWindowMinutes: 240,
          collapsedTitle: `${thread.title} is getting active`,
          collapsedBody: 'Your thread is gaining more activity — check out the latest replies.',
          metadataJson: {
            threadId: thread.id,
            replyId: reply.id,
            actorId: userId,
            reason: 'thread reply activity',
          },
        })
        .catch((error) => {
          console.error(`Failed to create thread reply notification for ${thread.id}:`, error?.message ?? error);
        });

              if (thread.panel === ThreadPanel.ALUMNI) {
        const mentorMatches = await this.mentorClusteringService
          .findRelevantMentors({
            title: thread.title,
            description: content,
            panel: thread.panel,
            limit: 3,
            excludeUserIds: [userId],
          })
          .catch((error) => {
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
                // No reply.id — stable per thread+mentor, so repeat
                // replies in the same thread collapse into one
                // notification instead of one per reply.
                dedupeKey: `mentor-thread:${thread.id}:${match.userId}`,
                collapsible: true,
                collapseWindowMinutes: 240,
                collapsedTitle: `${thread.title} is getting active`,
                collapsedBody: `This alumni discussion matching your expertise is gaining more replies.`,
                metadataJson: {
                  matchReason: match.reason,
                  matchedSignals: match.matchedSignals,
                  panel: thread.panel,
                },
              })
              .catch((error) => {
                console.error(`Failed to create mentor notification for reply ${reply.id}:`, error?.message ?? error);
              }),
          ),
        );
      }

    }

    return Object.assign(reply, { attachments: createdAttachments });
  }
}
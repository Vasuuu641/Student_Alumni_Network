import { Injectable, Inject } from '@nestjs/common';
import type { ThreadRepository } from 'src/domain/repositories/thread.repository';
import { ThreadPanel, ThreadStatus } from 'src/domain/entities/thread.entity';
import { ThreadAccessPolicy } from './policies/thread-access-policy';
import { Role } from 'src/domain/entities/authorized-user.entity';
import type { ThreadLLMService } from 'src/domain/services/thread-llm.service';
import { MentorClusteringService } from 'src/infrastructure/ai/cohere/mentor-clustering.service';
import { CreateNotificationUseCase } from '../notifications/create-notification.usecase';
import { NotificationType } from 'src/domain/entities/notification.entity';
import { PersonalizedNotificationFanoutService } from 'src/infrastructure/services/personalized-notification-fanout.service';

@Injectable()
export class CreateThreadUseCase {
  constructor(
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
    @Inject('ThreadLLMService') private readonly threadLLMService: ThreadLLMService,
    private readonly mentorClusteringService: MentorClusteringService,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
    private readonly personalizedNotificationFanoutService: PersonalizedNotificationFanoutService,
  ) {}

  async execute(
    userId: string,
    userRole: Role,
    title: string,
    description: string | null,
    panel: ThreadPanel,
  ): Promise<string> {
    ThreadAccessPolicy.validatePanelAccess(userRole, panel);

    const now = new Date();

    const thread = await this.threadRepository.create({
      id: this.generateUniqueId(),
      title,
      description,
      panel,
      status: ThreadStatus.OPEN,
      authorId: userId,
      replyCount: 0,
      lastReplyAt: null,
      viewCount: 0,
      voteScore: 0,
      createdAt: now,
      updatedAt: now,
      isAuthoredBy: (checkUserId: string) => userId === checkUserId,
      isOpen: () => true,
      canAcceptReplies: () => true,
    });

    // Embed in background — don't await so user gets response immediately
    this.threadLLMService.embedThread(thread.id, title).catch((err) => {
      console.error(`Background embed failed for thread ${thread.id}:`, err.message);
    });

    if (panel === ThreadPanel.ALUMNI) {
      const mentorMatches = await this.mentorClusteringService.findRelevantMentors({
        title,
        description,
        panel,
        limit: 3,
        excludeUserIds: [userId],
      });

      await Promise.all(
        mentorMatches.map((match) =>
          this.createNotificationUseCase
            .execute({
              userId: match.userId,
              type: NotificationType.THREAD_ACTIVITY,
              title: `A discussion matches your expertise`,
              body: `A new alumni thread may be relevant to your experience: ${title}`,
              entityType: 'THREAD',
              entityId: thread.id,
              sourceModule: 'mentor-clustering',
              actionUrl: `/threads/${thread.id}`,
              score: match.score,
              dedupeKey: `mentor-thread:${thread.id}:${match.userId}`,
              metadataJson: {
                matchReason: match.reason,
                matchedSignals: match.matchedSignals,
                panel,
              },
            })
            .catch((error) => {
              console.error(
                `Failed to create mentor notification for thread ${thread.id}:`,
                error?.message ?? error,
              );
            }),
        ),
      );
    } else {
      await this.personalizedNotificationFanoutService.notifyRelevantUsers({
        type: NotificationType.THREAD_ACTIVITY,
        title: `New discussion: ${title}`,
        body: description ?? 'A new discussion may match your interests.',
        entityType: 'THREAD',
        entityId: thread.id,
        sourceModule: 'threads',
        actionUrl: `/threads/${thread.id}`,
        excludeUserIds: [userId],
        threadTitle: title,
        threadPanel: panel,
        metadataJson: {
          panel,
          createdBy: userId,
        },
        dedupeKeyPrefix: 'thread-interest',
        limit: 5,
        minScore: 0.45,
      });
    }

    return thread.id;
  }

  private generateUniqueId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}
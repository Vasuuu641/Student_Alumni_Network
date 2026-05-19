import { Inject, Injectable } from '@nestjs/common';
import { CreateNotificationUseCase } from 'src/application/notifications/create-notification.usecase';
import { NotificationChannel, NotificationType } from 'src/domain/entities/notification.entity';
import type { UserInterestProfileRepository } from 'src/domain/repositories/user-interest.repository';
import { NotificationAIScoringService } from './notification-ai-scoring.service';

export interface PersonalizedNotificationFanoutRequest {
  type: NotificationType;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  sourceModule: string;
  actionUrl?: string | null;
  dedupeKeyPrefix?: string;
  metadataJson?: Record<string, unknown> | null;
  deliveryChannels?: NotificationChannel[];
  excludeUserIds?: string[];
  threadTitle?: string;
  threadPanel?: 'ACADEMIC' | 'ALUMNI';
  limit?: number;
  minScore?: number;
}

@Injectable()
export class PersonalizedNotificationFanoutService {
  private readonly DEFAULT_LIMIT = 5;
  private readonly DEFAULT_MIN_SCORE = 0.45;

  constructor(
    @Inject('UserInterestProfileRepository')
    private readonly interestProfileRepository: UserInterestProfileRepository,
    private readonly aiScoring: NotificationAIScoringService,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
  ) {}

  async notifyRelevantUsers(request: PersonalizedNotificationFanoutRequest): Promise<number> {
    const profiles = await this.interestProfileRepository.findAll();
    const excluded = new Set(request.excludeUserIds ?? []);
    const safeLimit = Math.max(1, request.limit ?? this.DEFAULT_LIMIT);
    const minScore = request.minScore ?? this.DEFAULT_MIN_SCORE;

    const scoredRecipients = await Promise.all(
      profiles
        .filter((profile) => !excluded.has(profile.userId))
        .map(async (profile) => {
          const result = await this.aiScoring.scoreNotification(
            profile.userId,
            request.title,
            request.body,
            request.threadTitle,
            request.threadPanel,
          );

          return {
            userId: profile.userId,
            score: result.score,
            reason: result.reason,
          };
        }),
    );

    const recipients = scoredRecipients
      .filter((recipient) => recipient.score >= minScore)
      .sort((left, right) => right.score - left.score)
      .slice(0, safeLimit);

    await Promise.all(
      recipients.map(async (recipient) => {
        await this.createNotificationUseCase.execute({
          userId: recipient.userId,
          type: request.type,
          title: request.title,
          body: request.body,
          entityType: request.entityType,
          entityId: request.entityId,
          sourceModule: request.sourceModule,
          score: recipient.score,
          actionUrl: request.actionUrl ?? null,
          dedupeKey: `${request.dedupeKeyPrefix ?? request.sourceModule}:${request.entityId}:${recipient.userId}`,
          metadataJson: {
            ...(request.metadataJson ?? {}),
            aiScore: recipient.score,
            personalizationReason: recipient.reason,
          },
          deliveryChannels: request.deliveryChannels ?? [NotificationChannel.IN_APP],
        });
      }),
    );

    return recipients.length;
  }
}
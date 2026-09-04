import { Inject, Injectable, Logger } from '@nestjs/common';
import { PersonalizedNotificationFanoutRequest } from '../services/personalized-notification-fanout.service';
import type { UserInterestProfileRepository } from 'src/domain/repositories/user-interest.repository';
import { NotificationAIScoringService } from '../services/notification-ai-scoring.service';
import { CreateNotificationUseCase } from 'src/application/notifications/create-notification.usecase';
import { NotificationChannel } from 'src/domain/entities/notification.entity';

@Injectable()
export class PersonalizedNotificationWorkerService {
  private readonly logger = new Logger(PersonalizedNotificationWorkerService.name);
  // Simple per-user rate limit: max notifications per minute
  private readonly MAX_PER_MINUTE = 5;
  private readonly perUserTimestamps: Map<string, number[]> = new Map();

  constructor(
    @Inject('UserInterestProfileRepository')
    private readonly interestProfileRepo: UserInterestProfileRepository,
    private readonly aiScoring: NotificationAIScoringService,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
  ) {}

  private pruneOld(userId: string) {
    const now = Date.now();
    const window = 60_000;
    const arr = this.perUserTimestamps.get(userId) ?? [];
    const filtered = arr.filter((t) => now - t < window);
    this.perUserTimestamps.set(userId, filtered);
    return filtered;
  }

  private record(userId: string) {
    const arr = this.pruneOld(userId);
    arr.push(Date.now());
    this.perUserTimestamps.set(userId, arr);
  }

  async process(request: PersonalizedNotificationFanoutRequest): Promise<number> {
    const profiles = await this.interestProfileRepo.findAll();
    const excluded = new Set(request.excludeUserIds ?? []);
    const safeLimit = Math.max(1, request.limit ?? 5);
    const minScore = request.minScore ?? 0.45;

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

    let created = 0;

    for (const recipient of recipients) {
      const recent = this.pruneOld(recipient.userId);
      if (recent.length >= this.MAX_PER_MINUTE) {
        this.logger.debug(`Skipping ${recipient.userId} due to rate limit`);
        continue;
      }

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

      this.record(recipient.userId);
      created++;
    }

    return created;
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationAIScoringService } from './notification-ai-scoring.service';
import type {
  UserInterestProfileRepository,
  UserInterestSignalRepository,
} from 'src/domain/repositories/user-interest.repository';
import {
  InterestSignalType,
  UserInterestSignal,
  UserInterestProfile,
} from 'src/domain/entities/user-interest.entity';

export interface NotificationEligibilityResult {
  passed: boolean;
  aiScore: number;
  finalScore: number;
  reason: string;
  signals: UserInterestSignal[];
}

@Injectable()
export class NotificationEligibilityService {
  private readonly logger = new Logger(NotificationEligibilityService.name);
  private readonly SCORE_THRESHOLD = 0.6;
  private readonly DEDUP_WINDOW_HOURS = 4;

  constructor(
    @Inject('UserInterestProfileRepository')
    private readonly interestProfileRepository: UserInterestProfileRepository,
    @Inject('UserInterestSignalRepository')
    private readonly signalRepository: UserInterestSignalRepository,
    private readonly aiScoring: NotificationAIScoringService,
  ) {}

  /**
   * Check if a notification should be delivered to a user.
   * Uses AI scoring + past behavior signals + eligibility rules.
   */
  async checkEligibility(
    userId: string,
    entityId: string,
    notificationTitle: string,
    notificationBody: string,
    threadTitle?: string,
    threadPanel?: 'ACADEMIC' | 'ALUMNI',
  ): Promise<NotificationEligibilityResult> {
    try {
      const signals = await this.signalRepository.findByEntityAndUser(
        userId,
        'THREAD',
        entityId,
      );

      const profile =
        await this.interestProfileRepository.findByUserId(userId);

      if (!profile) {
        return {
          passed: false,
          aiScore: 0,
          finalScore: 0,
          signals: [],
          reason: 'No interest profile',
        };
      }

      const { score: aiScore, reason: scoringReason } =
        await this.aiScoring.scoreNotification(
          userId,
          notificationTitle,
          notificationBody,
          threadTitle,
          threadPanel,
        );

      const rawScore = this.computeSignalScore(signals, profile, threadPanel);
      const finalScore = (aiScore + rawScore) / 2;

      if (finalScore < this.SCORE_THRESHOLD) {
        return {
          passed: false,
          aiScore,
          finalScore,
          signals,
          reason: `Score ${finalScore.toFixed(2)} below threshold ${this.SCORE_THRESHOLD}. AI: ${scoringReason}`,
        };
      }

      return {
        passed: true,
        aiScore,
        finalScore,
        signals,
        reason: `Score ${finalScore.toFixed(2)} passes. AI: ${scoringReason}`,
      };
    } catch (error) {
      this.logger.error(
        `Eligibility check failed for user ${userId}: ${this.formatError(error)}`,
      );

      return {
        passed: false,
        aiScore: 0,
        finalScore: 0,
        signals: [],
        reason: 'Eligibility check failed',
      };
    }
  }

  /**
   * Capture a user interest signal (e.g., thread view, reply, like).
   */
  async captureSignal(
    userId: string,
    type: InterestSignalType,
    entityType: string,
    entityId: string,
    sourcePanel?: string,
    sourceModule?: string,
  ): Promise<UserInterestSignal> {
    const strength = this.getSignalStrength(type);

    return this.signalRepository.create(
      new UserInterestSignal(
        Math.random().toString(36).substring(2, 11),
        userId,
        type,
        entityType,
        entityId,
        sourcePanel ?? null,
        sourceModule ?? 'unknown',
        strength,
        null,
        new Date(),
      ),
    );
  }

  /**
   * Compute raw signal-based relevance score.
   */
  private computeSignalScore(
    signals: UserInterestSignal[],
    profile: UserInterestProfile,
    threadPanel?: 'ACADEMIC' | 'ALUMNI',
  ): number {
    if (signals.length === 0) return 0.3;

    const signalScore = Math.min(1, signals.reduce((sum, s) => sum + s.strength * 0.15, 0));
    const panelBonus = threadPanel ? profile.getWeightForPanel(threadPanel) : 0.5;

    return signalScore * 0.7 + panelBonus * 0.3;
  }

  /**
   * Determine signal strength based on type.
   */
  private getSignalStrength(type: InterestSignalType): number {
    const strengths: Record<InterestSignalType, number> = {
      [InterestSignalType.THREAD_REPLY]: 1.0,
      [InterestSignalType.THREAD_SAVE]: 0.9,
      [InterestSignalType.THREAD_LIKE]: 0.7,
      [InterestSignalType.THREAD_OPEN]: 0.5,
      [InterestSignalType.THREAD_VIEW]: 0.3,
      [InterestSignalType.CATEGORY_BROWSE]: 0.4,
      [InterestSignalType.PANEL_FOCUS]: 0.5,
      [InterestSignalType.GEO_VISIT]: 0.8,
      [InterestSignalType.GEO_SAVE]: 0.8,
      [InterestSignalType.GEO_VIEW]: 0.3,
    };

    return strengths[type] ?? 0.2;
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}

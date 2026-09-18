import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
import { GeoHelpSpotCategory } from 'src/domain/entities/geo-help-spot.entity';

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

  constructor(
    @Inject('UserInterestProfileRepository')
    private readonly interestProfileRepository: UserInterestProfileRepository,
    @Inject('UserInterestSignalRepository')
    private readonly signalRepository: UserInterestSignalRepository,
    private readonly aiScoring: NotificationAIScoringService,
  ) {}

  async checkEligibility(
    userId: string,
    entityType: string,
    entityId: string,
    notificationTitle: string,
    notificationBody: string,
    threadTitle?: string,
    threadPanel?: 'ACADEMIC' | 'ALUMNI',
    geoCategory?: GeoHelpSpotCategory,
  ): Promise<NotificationEligibilityResult> {
    try {
      const signals = await this.signalRepository.findByEntityAndUser(
        userId,
        entityType,
        entityId,
      );

      const profile = await this.interestProfileRepository.findByUserId(userId);

      if (!profile) {
        return {
          passed: false,
          aiScore: 0,
          finalScore: 0,
          signals: [],
          reason: 'No interest profile',
        };
      }

      const { score: aiScore, reason: scoringReason } = await this.aiScoring.scoreNotification(
        userId,
        notificationTitle,
        notificationBody,
        threadTitle,
        threadPanel,
      );

      const rawScore = this.computeSignalScore(signals, profile, threadPanel, geoCategory);
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
      this.logger.error(`Eligibility check failed for user ${userId}: ${this.formatError(error)}`);
      return {
        passed: false,
        aiScore: 0,
        finalScore: 0,
        signals: [],
        reason: 'Eligibility check failed',
      };
    }
  }

  async captureSignal(
    userId: string,
    type: InterestSignalType,
    entityType: string,
    entityId: string,
    sourcePanel?: string,
    sourceModule?: string,
  ): Promise<UserInterestSignal> {
    const strength = this.getSignalStrength(type);

    const existingProfile = await this.interestProfileRepository.findByUserId(userId);
    if (!existingProfile) {
      const now = new Date();
      await this.interestProfileRepository.upsert(
        new UserInterestProfile(userId, 0.5, 0.5, 0.3, 0.3, 0.2, 0.3, 0.4, 0.4, 0.4, 0.3, now, now, now),
      );
    }

    return this.signalRepository.create(
      new UserInterestSignal(
        randomUUID(),
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

  private computeSignalScore(
    signals: UserInterestSignal[],
    profile: UserInterestProfile,
    threadPanel?: 'ACADEMIC' | 'ALUMNI',
    geoCategory?: GeoHelpSpotCategory,
  ): number {
    if (signals.length === 0) return 0.3;

    const signalScore = Math.min(1, signals.reduce((sum, s) => sum + s.strength * 0.15, 0));

    let categoryBonus = 0.5;
    if (threadPanel) {
      categoryBonus = profile.getWeightForPanel(threadPanel);
    } else if (geoCategory) {
      categoryBonus = profile.getWeightForGeoCategory(geoCategory) ?? 0.5;
    }

    return signalScore * 0.7 + categoryBonus * 0.3;
  }

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
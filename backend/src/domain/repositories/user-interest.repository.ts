import {
  UserInterestProfile,
  UserInterestSignal,
  InterestSignalType,
  NotificationCandidate,
} from '../entities/user-interest.entity';

export interface UserInterestProfileRepository {
  findByUserId(userId: string): Promise<UserInterestProfile | null>;
  findAll(): Promise<UserInterestProfile[]>;
  upsert(profile: UserInterestProfile): Promise<UserInterestProfile>;
  incrementWeight(
    userId: string,
    weightKey: string,
    delta: number,
  ): Promise<void>;
}

export interface UserInterestSignalRepository {
  create(signal: UserInterestSignal): Promise<UserInterestSignal>;
  findRecentByUserId(
    userId: string,
    hours: number,
  ): Promise<UserInterestSignal[]>;
  findByEntityAndUser(
    userId: string,
    entityType: string,
    entityId: string,
  ): Promise<UserInterestSignal[]>;
}

export interface NotificationCandidateRepository {
  create(candidate: NotificationCandidate): Promise<NotificationCandidate>;
  findPending(
    userId: string,
    limit: number,
  ): Promise<NotificationCandidate[]>;
  updateScore(
    candidateId: string,
    aiScore: number,
    finalScore: number,
    isEligible: boolean,
    reason: string | null,
  ): Promise<NotificationCandidate>;
  markAsProcessed(
    candidateId: string,
    notificationId: string,
  ): Promise<void>;
}

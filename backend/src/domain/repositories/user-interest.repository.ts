import {
  UserInterestProfile,
  UserInterestSignal,
  InterestSignalType,
} from '../entities/user-interest.entity';

export interface UserInterestProfileRepository {
  findByUserId(userId: string): Promise<UserInterestProfile | null>;
  findAll(): Promise<UserInterestProfile[]>;
  findEligibleForPanel(
    panel: 'ACADEMIC' | 'ALUMNI',
    minWeight: number,
  ): Promise<UserInterestProfile[]>;
  upsert(profile: UserInterestProfile): Promise<UserInterestProfile>;
  incrementWeight(
    userId: string,
    weightKey: 'academicWeight' | 'alumniWeight' | 'careerWeight' | 'housingWeight' | 'shoppingWeight' | 'internshipWeight',
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




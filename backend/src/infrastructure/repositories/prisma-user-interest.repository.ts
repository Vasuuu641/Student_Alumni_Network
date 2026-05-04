import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import {
  UserInterestProfile,
  UserInterestSignal,
  InterestSignalType,
  NotificationCandidate,
} from 'src/domain/entities/user-interest.entity';
import type {
  UserInterestProfileRepository,
  UserInterestSignalRepository,
  NotificationCandidateRepository,
} from 'src/domain/repositories/user-interest.repository';

@Injectable()
export class PrismaUserInterestProfileRepository
  implements UserInterestProfileRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<UserInterestProfile | null> {
    const record = await this.prisma.userInterestProfile.findUnique({
      where: { userId },
    });
    return record ? this.toDomain(record) : null;
  }

  async upsert(profile: UserInterestProfile): Promise<UserInterestProfile> {
    const record = await this.prisma.userInterestProfile.upsert({
      where: { userId: profile.userId },
      create: {
        userId: profile.userId,
        academicWeight: profile.academicWeight,
        alumniWeight: profile.alumniWeight,
        careerWeight: profile.careerWeight,
        housingWeight: profile.housingWeight,
        shoppingWeight: profile.shoppingWeight,
        internshipWeight: profile.internshipWeight,
        lastUpdatedAt: new Date(),
      },
      update: {
        academicWeight: profile.academicWeight,
        alumniWeight: profile.alumniWeight,
        careerWeight: profile.careerWeight,
        housingWeight: profile.housingWeight,
        shoppingWeight: profile.shoppingWeight,
        internshipWeight: profile.internshipWeight,
        lastUpdatedAt: new Date(),
      },
    });

    return this.toDomain(record);
  }

  async incrementWeight(
    userId: string,
    weightKey: string,
    delta: number,
  ): Promise<void> {
    const existing = await this.prisma.userInterestProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      return;
    }

    const updatedData: any = { lastUpdatedAt: new Date() };
    const currentWeight = (existing as any)[weightKey] ?? 0;
    updatedData[weightKey] = Math.max(0, Math.min(1, currentWeight + delta));

    await this.prisma.userInterestProfile.update({
      where: { userId },
      data: updatedData,
    });
  }

  private toDomain(record: any): UserInterestProfile {
    return new UserInterestProfile(
      record.userId,
      record.academicWeight,
      record.alumniWeight,
      record.careerWeight,
      record.housingWeight,
      record.shoppingWeight,
      record.internshipWeight,
      record.lastUpdatedAt,
      record.createdAt,
      record.updatedAt,
    );
  }
}

@Injectable()
export class PrismaUserInterestSignalRepository
  implements UserInterestSignalRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async create(signal: UserInterestSignal): Promise<UserInterestSignal> {
    const record = await this.prisma.userInterestSignal.create({
      data: {
        userId: signal.userId,
        type: signal.type as InterestSignalType,
        entityType: signal.entityType,
        entityId: signal.entityId,
        sourcePanel: signal.sourcePanel,
        sourceModule: signal.sourceModule,
        strength: signal.strength,
        metadataJson: signal.metadataJson ?? undefined,
      },
    });

    return this.toDomain(record);
  }

  async findRecentByUserId(
    userId: string,
    hours: number,
  ): Promise<UserInterestSignal[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const records = await this.prisma.userInterestSignal.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async findByEntityAndUser(
    userId: string,
    entityType: string,
    entityId: string,
  ): Promise<UserInterestSignal[]> {
    const records = await this.prisma.userInterestSignal.findMany({
      where: { userId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): UserInterestSignal {
    return new UserInterestSignal(
      record.id,
      record.userId,
      record.type as InterestSignalType,
      record.entityType,
      record.entityId,
      record.sourcePanel,
      record.sourceModule,
      record.strength,
      record.metadataJson,
      record.createdAt,
    );
  }
}

@Injectable()
export class PrismaNotificationCandidateRepository
  implements NotificationCandidateRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async create(
    candidate: NotificationCandidate,
  ): Promise<NotificationCandidate> {
    const record = await this.prisma.notificationCandidate.create({
      data: {
        id: candidate.id,
        userId: candidate.userId,
        type: candidate.type,
        title: candidate.title,
        body: candidate.body,
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        sourceModule: candidate.sourceModule,
        actionUrl: candidate.actionUrl,
        dedupeKey: candidate.dedupeKey,
        metadataJson: candidate.metadataJson ?? undefined,
        rawScore: candidate.rawScore,
        aiScore: candidate.aiScore,
        finalScore: candidate.finalScore,
        isEligible: candidate.isEligible,
        scoringReason: candidate.scoringReason,
        rejectionReason: candidate.rejectionReason,
        expiresAt: candidate.expiresAt,
      },
    });

    return this.toDomain(record);
  }

  async findPending(
    userId: string,
    limit: number,
  ): Promise<NotificationCandidate[]> {
    const records = await this.prisma.notificationCandidate.findMany({
      where: {
        userId,
        notificationId: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { finalScore: 'desc' },
      take: limit,
    });

    return records.map((r) => this.toDomain(r));
  }

  async updateScore(
    candidateId: string,
    aiScore: number,
    finalScore: number,
    isEligible: boolean,
    reason: string | null,
  ): Promise<NotificationCandidate> {
    const record = await this.prisma.notificationCandidate.update({
      where: { id: candidateId },
      data: {
        aiScore,
        finalScore,
        isEligible,
        scoringReason: reason,
      },
    });

    return this.toDomain(record);
  }

  async markAsProcessed(
    candidateId: string,
    notificationId: string,
  ): Promise<void> {
    await this.prisma.notificationCandidate.update({
      where: { id: candidateId },
      data: { notificationId },
    });
  }

  private toDomain(record: any): NotificationCandidate {
    return new NotificationCandidate(
      record.id,
      record.userId,
      record.type,
      record.title,
      record.body,
      record.entityType,
      record.entityId,
      record.sourceModule,
      record.rawScore,
      record.aiScore,
      record.finalScore,
      record.isEligible,
      record.scoringReason,
      record.rejectionReason,
      record.actionUrl,
      record.dedupeKey,
      record.metadataJson,
      record.createdAt,
      record.expiresAt,
    );
  }
}

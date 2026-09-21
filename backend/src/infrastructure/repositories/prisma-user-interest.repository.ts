import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import {
  UserInterestProfile,
  UserInterestSignal,
  InterestSignalType,
} from 'src/domain/entities/user-interest.entity';
import type {
  UserInterestProfileRepository,
  UserInterestSignalRepository,
} from 'src/domain/repositories/user-interest.repository';
import { GeoHelpSpotCategory } from 'src/domain/entities/geo-help-spot.entity';


@Injectable()
export class PrismaUserInterestProfileRepository
  implements UserInterestProfileRepository
{
  constructor(private readonly prisma: PrismaService) {}
  async findEligibleForPanel(
    panel: 'ACADEMIC' | 'ALUMNI',
    minWeight: number,
  ): Promise<UserInterestProfile[]> {
    const column = panel === 'ACADEMIC' ? 'academicWeight' : 'alumniWeight';

    const records = await this.prisma.userInterestProfile.findMany({
      where: { [column]: { gte: minWeight } },
      orderBy: { lastUpdatedAt: 'desc' },
    });

    return records.map((record) => this.toDomain(record));
  }

  async findEligibleForGeoCategory(
  category: GeoHelpSpotCategory,
  minWeight: number,
): Promise<UserInterestProfile[]> {
  const columnMap: Partial<Record<GeoHelpSpotCategory, string>> = {
    [GeoHelpSpotCategory.UNIVERSITY_SERVICE]: 'campusServicesWeight',
    [GeoHelpSpotCategory.ACADEMIC_DEPARTMENT]: 'campusServicesWeight',
    [GeoHelpSpotCategory.ADMIN_OFFICE]: 'campusServicesWeight',
    [GeoHelpSpotCategory.STUDENT_SUPPORT]: 'campusServicesWeight',
    [GeoHelpSpotCategory.RESTAURANT]: 'foodWeight',
    [GeoHelpSpotCategory.CAFE]: 'foodWeight',
    [GeoHelpSpotCategory.STUDY_SPOT]: 'studyWeight',
    [GeoHelpSpotCategory.CAMPUS_FACILITY]: 'studyWeight',
    [GeoHelpSpotCategory.SOCIAL_HANGOUT]: 'socialWeight',
    [GeoHelpSpotCategory.FITNESS_WELLNESS]: 'socialWeight',
    [GeoHelpSpotCategory.SHOPPING]: 'shoppingWeight',
  };

  const column = columnMap[category];
  if (!column) {
    // OTHER, or any future category with no mapping — no cheap pre-filter possible
    return this.prisma.userInterestProfile.findMany({ orderBy: { lastUpdatedAt: 'desc' } })
      .then((records) => records.map((r) => this.toDomain(r)));
  }

  const records = await this.prisma.userInterestProfile.findMany({
    where: { [column]: { gte: minWeight } },
    orderBy: { lastUpdatedAt: 'desc' },
  });

  return records.map((record) => this.toDomain(record));
}

  async findByUserId(userId: string): Promise<UserInterestProfile | null> {
    const record = await this.prisma.userInterestProfile.findUnique({
      where: { userId },
    });
    return record ? this.toDomain(record) : null;
  }

  async findAll(): Promise<UserInterestProfile[]> {
    const records = await this.prisma.userInterestProfile.findMany({
      orderBy: { lastUpdatedAt: 'desc' },
    });

    return records.map((record) => this.toDomain(record));
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
      campusServicesWeight: profile.campusServicesWeight,
      foodWeight: profile.foodWeight,
      studyWeight: profile.studyWeight,
      socialWeight: profile.socialWeight,
      lastUpdatedAt: new Date(),
    },
    update: {
      academicWeight: profile.academicWeight,
      alumniWeight: profile.alumniWeight,
      careerWeight: profile.careerWeight,
      housingWeight: profile.housingWeight,
      shoppingWeight: profile.shoppingWeight,
      internshipWeight: profile.internshipWeight,
      campusServicesWeight: profile.campusServicesWeight,
      foodWeight: profile.foodWeight,
      studyWeight: profile.studyWeight,
      socialWeight: profile.socialWeight,
      lastUpdatedAt: new Date(),
    },
  });

  return this.toDomain(record);
}

  async incrementWeight(
    userId: string,
    weightKey:
      | 'academicWeight'
      | 'alumniWeight'
      | 'careerWeight'
      | 'housingWeight'
      | 'shoppingWeight'
      | 'internshipWeight'
      | 'campusServicesWeight'
      | 'foodWeight'
      | 'studyWeight'
      | 'socialWeight',
    delta: number,
  ): Promise<void> {
    const existing = await this.prisma.userInterestProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      return;
    }

    const updatedData: any = { lastUpdatedAt: new Date() };
    const currentWeight = existing[weightKey] ?? 0;
    updatedData[weightKey] = Math.max(0, Math.min(1, currentWeight + delta));

    await this.prisma.userInterestProfile.update({
      where: { userId },
      data: updatedData,
    });
  }

  // PrismaUserInterestProfileRepository
private toDomain(record: any): UserInterestProfile {
  return new UserInterestProfile(
    record.userId,
    record.academicWeight,
    record.alumniWeight,
    record.careerWeight,
    record.housingWeight,
    record.shoppingWeight,
    record.internshipWeight,
    record.campusServicesWeight,
    record.foodWeight,
    record.studyWeight,
    record.socialWeight,
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


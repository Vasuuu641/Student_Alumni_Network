import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import type {
  CreateGeoHelpSpotInput,
  DuplicateGeoHelpSpotCheckInput,
  GeoHelpBoardRepository,
  ListGeoHelpSpotsForAdminFilter,
  ListGeoHelpSpotsFilter,
  UpdateGeoHelpSpotInput,
} from '../../domain/repositories/geo-help-board.repository';
import { GeoHelpSpot, GeoHelpSpotCategory, GeoHelpSpotReviewStatus, GeoHelpSpotSection, GeoHelpSpotVisit, GeoHelpSpotWithDistance } from '../../domain/entities/geo-help-spot.entity';

@Injectable()
export class PrismaGeoHelpBoardRepository implements GeoHelpBoardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSpot(input: CreateGeoHelpSpotInput): Promise<GeoHelpSpot> {
    const created = await this.prisma.geoHelpSpot.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        city: input.city,
        address: input.address ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        section: input.section,
        category: input.category,
        createdById: input.createdById,
        reviewStatus: GeoHelpSpotReviewStatus.PENDING,
      } as any,
    });

    return this.toDomain(created);
  }

  async findSpotById(spotId: string): Promise<GeoHelpSpot | null> {
    const found = await this.prisma.geoHelpSpot.findUnique({ where: { id: spotId } });
    return found ? this.toDomain(found) : null;
  }

  async findPotentialDuplicate(input: DuplicateGeoHelpSpotCheckInput): Promise<GeoHelpSpot | null> {
    const radiusKm = input.radiusKm ?? 0.2;
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((input.latitude * Math.PI) / 180));

    const minLat = input.latitude - latDelta;
    const maxLat = input.latitude + latDelta;
    const minLng = input.longitude - lngDelta;
    const maxLng = input.longitude + lngDelta;

    const candidates = await this.prisma.geoHelpSpot.findMany({
      where: {
        isActive: true,
        city: input.city,
        section: input.section,
        category: input.category,
        latitude: {
          gte: minLat,
          lte: maxLat,
        },
        longitude: {
          gte: minLng,
          lte: maxLng,
        },
      } as any,
      take: 20,
    });

    const normalize = (value: string) => value.trim().toLowerCase();
    const requestedTitle = normalize(input.title);

    for (const candidate of candidates) {
      const distanceKm = this.haversineDistanceKm(
        input.latitude,
        input.longitude,
        Number(candidate.latitude),
        Number(candidate.longitude),
      );

      const titleMatches = normalize(candidate.title) === requestedTitle;
      const samePinThresholdKm = 0.05;

      if (distanceKm <= radiusKm && (titleMatches || distanceKm <= samePinThresholdKm)) {
        return this.toDomain(candidate);
      }
    }

    return null;
  }

  async updateSpot(input: UpdateGeoHelpSpotInput): Promise<GeoHelpSpot> {
    const updated = await this.prisma.geoHelpSpot.update({
      where: { id: input.spotId },
      data: {
        title: input.title,
        description: input.description,
        city: input.city,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        section: input.section,
        category: input.category,
      } as any,
    });

    return this.toDomain(updated);
  }

  async deactivateSpot(spotId: string): Promise<GeoHelpSpot> {
    const updated = await this.prisma.geoHelpSpot.update({
      where: { id: spotId },
      data: { isActive: false } as any,
    });

    return this.toDomain(updated);
  }

  async reviewSpot(input: { spotId: string; reviewStatus: GeoHelpSpotReviewStatus; reviewerId: string }): Promise<GeoHelpSpot> {
    const updated = await this.prisma.geoHelpSpot.update({
      where: { id: input.spotId },
      data: {
        reviewStatus: input.reviewStatus,
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
      } as any,
    });

    return this.toDomain(updated);
  }

  async listPopularSpots(filter: ListGeoHelpSpotsFilter): Promise<GeoHelpSpot[]> {
    const take = filter.limit ?? 20;
    const skip = filter.offset ?? 0;

    const records = await this.prisma.geoHelpSpot.findMany({
      where: {
        city: filter.city,
        section: filter.section,
        category: filter.category,
        isActive: filter.isActive ?? true,
        reviewStatus: GeoHelpSpotReviewStatus.VERIFIED,
      } as any,
      orderBy: [{ visitCount: 'desc' }, { createdAt: 'desc' }],
      take,
      skip,
    });

    return records.map((record) => this.toDomain(record));
  }

  async listSpotsForAdmin(filter: ListGeoHelpSpotsForAdminFilter): Promise<GeoHelpSpot[]> {
    const take = filter.limit ?? 20;
    const skip = filter.offset ?? 0;

    const records = await this.prisma.geoHelpSpot.findMany({
      where: {
        city: filter.city,
        section: filter.section,
        category: filter.category,
        isActive: filter.isActive,
        reviewStatus: filter.reviewStatus,
      } as any,
      orderBy: [{ createdAt: 'desc' }],
      take,
      skip,
    });

    return records.map((record) => this.toDomain(record));
  }

  async listNearbySpots(params: {
    latitude: number;
    longitude: number;
    radiusKm: number;
    city?: string;
    section?: GeoHelpSpotSection;
    category?: GeoHelpSpotCategory;
    limit?: number;
    offset?: number;
  }): Promise<GeoHelpSpotWithDistance[]> {
    const take = params.limit ?? 20;
    const skip = params.offset ?? 0;

    const latDelta = params.radiusKm / 111;
    const lngDelta = params.radiusKm / (111 * Math.cos((params.latitude * Math.PI) / 180));

    const minLat = params.latitude - latDelta;
    const maxLat = params.latitude + latDelta;
    const minLng = params.longitude - lngDelta;
    const maxLng = params.longitude + lngDelta;

    const candidates = await this.prisma.geoHelpSpot.findMany({
      where: {
        isActive: true,
        reviewStatus: GeoHelpSpotReviewStatus.VERIFIED,
        city: params.city,
        section: params.section,
        category: params.category,
        latitude: {
          gte: minLat,
          lte: maxLat,
        },
        longitude: {
          gte: minLng,
          lte: maxLng,
        },
      } as any,
      take: Math.max(skip + take, 50),
      orderBy: [{ visitCount: 'desc' }],
    });

    return candidates
      .map((spot) => {
        const domain = this.toDomain(spot);
        const distanceKm = this.haversineDistanceKm(
          params.latitude,
          params.longitude,
          domain.latitude,
          domain.longitude,
        );

        return { ...domain, distanceKm } as GeoHelpSpotWithDistance;
      })
      .filter((spot) => spot.distanceKm <= params.radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(skip, skip + take);
  }

  async recordVisit(spotId: string, userId: string): Promise<GeoHelpSpotVisit> {
    const visit = await this.prisma.$transaction(async (tx: any) => {
      const createdVisit = await tx.geoHelpSpotVisit.upsert({
        where: {
          spotId_userId: {
            spotId,
            userId,
          },
        },
        create: {
          spotId,
          userId,
        },
        update: {
          visitedAt: new Date(),
        },
      });

      await tx.geoHelpSpot.update({
        where: { id: spotId },
        data: {
          visitCount: await tx.geoHelpSpotVisit.count({ where: { spotId } }),
        },
      });

      return createdVisit;
    });

    return new GeoHelpSpotVisit(visit.id, visit.spotId, visit.userId, visit.visitedAt);
  }

  private toDomain(record: any): GeoHelpSpot {
    return new GeoHelpSpot(
      record.id,
      record.title,
      record.description,
      record.city,
      record.address,
      Number(record.latitude),
      Number(record.longitude),
      record.section as GeoHelpSpotSection,
      record.category as GeoHelpSpotCategory,
      record.createdById,
      record.isActive,
      record.reviewStatus as GeoHelpSpotReviewStatus,
      record.reviewedById ?? null,
      record.reviewedAt ?? null,
      record.visitCount,
      record.createdAt,
      record.updatedAt,
    );
  }

  private haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const earthRadiusKm = 6371;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
  }
}

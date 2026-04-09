import { BadRequestException, Body, Controller, Get, HttpException, HttpStatus, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtStrategy } from '../../auth/jwt.strategy';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { RateLimitGuard } from '../../infrastructure/security/rate-limit.guard';
import { RateLimit } from '../../infrastructure/security/rate-limit.decorator';

import { CreateGeoHelpSpotUseCase } from '../../application/geo-help-board/create-geo-help-spot.usecase';
import { ListPopularGeoHelpSpotsUseCase } from '../../application/geo-help-board/list-popular-geo-help-spots.usecase';
import { ListNearbyGeoHelpSpotsUseCase } from '../../application/geo-help-board/list-nearby-geo-help-spots.usecase';
import { RecordGeoHelpSpotVisitUseCase } from '../../application/geo-help-board/record-geo-help-spot-visit.usecase';
import { EditGeoHelpSpotUseCase } from '../../application/geo-help-board/edit-geo-help-spot.usecase';
import { DeactivateGeoHelpSpotUseCase } from '../../application/geo-help-board/deactivate-geo-help-spot.usecase';
import { VerifyGeoHelpSpotUseCase } from '../../application/geo-help-board/verify-geo-help-spot.usecase';

import { CreateGeoHelpSpotDto } from './dto/create-geo-help-spot.dto';
import { UpdateGeoHelpSpotDto } from './dto/update-geo-help-spot.dto';
import { VerifyGeoHelpSpotDto } from './dto/verify-geo-help-spot.dto';
import { ListPopularGeoHelpSpotsQueryDto } from './dto/list-popular-geo-help-spots-query.dto';
import { ListNearbyGeoHelpSpotsQueryDto } from './dto/list-nearby-geo-help-spots-query.dto';
import { GeoHelpBoardError } from '../../application/geo-help-board/geo-help-board.errors';

@Controller('geo-help-board')
@UseGuards(JwtStrategy, RolesGuard)
@Roles('STUDENT', 'PROFESSOR')
export class GeoHelpBoardController {
  constructor(
    private readonly createGeoHelpSpotUseCase: CreateGeoHelpSpotUseCase,
    private readonly editGeoHelpSpotUseCase: EditGeoHelpSpotUseCase,
    private readonly deactivateGeoHelpSpotUseCase: DeactivateGeoHelpSpotUseCase,
    private readonly verifyGeoHelpSpotUseCase: VerifyGeoHelpSpotUseCase,
    private readonly listPopularGeoHelpSpotsUseCase: ListPopularGeoHelpSpotsUseCase,
    private readonly listNearbyGeoHelpSpotsUseCase: ListNearbyGeoHelpSpotsUseCase,
    private readonly recordGeoHelpSpotVisitUseCase: RecordGeoHelpSpotVisitUseCase,
  ) {}

  @Get('spots/popular')
  async listPopular(@Query() query: ListPopularGeoHelpSpotsQueryDto) {
    try {
      return await this.listPopularGeoHelpSpotsUseCase.execute({
        city: query.city,
        category: query.category as any,
        limit: query.limit,
      });
    } catch (error) {
      this.rethrowGeoHelpBoardError(error);
    }
  }

  @Get('spots/nearby')
  async listNearby(@Query() query: ListNearbyGeoHelpSpotsQueryDto) {
    try {
      return await this.listNearbyGeoHelpSpotsUseCase.execute({
        latitude: query.latitude,
        longitude: query.longitude,
        radiusKm: query.radiusKm,
        city: query.city,
        category: query.category as any,
        limit: query.limit,
      });
    } catch (error) {
      this.rethrowGeoHelpBoardError(error);
    }
  }

  @Post('spots')
  @UseGuards(RateLimitGuard)
  @RateLimit({ maxRequests: 5, windowMs: 60_000 })
  async createSpot(@Req() request: any, @Body() body: CreateGeoHelpSpotDto) {
    const createdById = request.user?.userId;
    try {
      return await this.createGeoHelpSpotUseCase.execute({
        title: body.title,
        description: body.description,
        city: body.city,
        address: body.address,
        latitude: body.latitude,
        longitude: body.longitude,
        category: body.category as any,
        createdById,
      });
    } catch (error) {
      this.rethrowGeoHelpBoardError(error);
    }
  }

  @Patch('spots/:spotId')
  @UseGuards(RateLimitGuard)
  @RateLimit({ maxRequests: 20, windowMs: 60_000 })
  async editSpot(@Req() request: any, @Param('spotId') spotId: string, @Body() body: UpdateGeoHelpSpotDto) {
    try {
      return await this.editGeoHelpSpotUseCase.execute({
        spotId,
        requesterId: request.user?.userId,
        requesterRole: request.user?.role,
        title: body.title,
        description: body.description,
        city: body.city,
        address: body.address,
        latitude: body.latitude,
        longitude: body.longitude,
        category: body.category as any,
      });
    } catch (error) {
      this.rethrowGeoHelpBoardError(error);
    }
  }

  @Patch('spots/:spotId/deactivate')
  @UseGuards(RateLimitGuard)
  @RateLimit({ maxRequests: 10, windowMs: 60_000 })
  async deactivateSpot(@Req() request: any, @Param('spotId') spotId: string) {
    try {
      return await this.deactivateGeoHelpSpotUseCase.execute({
        spotId,
        requesterId: request.user?.userId,
        requesterRole: request.user?.role,
      });
    } catch (error) {
      this.rethrowGeoHelpBoardError(error);
    }
  }

  @Patch('spots/:spotId/review')
  @Patch('spots/:spotId/verification')
  @Roles('ADMIN')
  @UseGuards(RateLimitGuard)
  @RateLimit({ maxRequests: 30, windowMs: 60_000 })
  async verifySpot(@Req() request: any, @Param('spotId') spotId: string, @Body() body: VerifyGeoHelpSpotDto) {
    try {
      return await this.verifyGeoHelpSpotUseCase.execute({
        spotId,
        isVerified: body.isVerified,
        reviewerId: request.user?.userId,
      });
    } catch (error) {
      this.rethrowGeoHelpBoardError(error);
    }
  }

  @Post('spots/:spotId/visit')
  @UseGuards(RateLimitGuard)
  @RateLimit({ maxRequests: 60, windowMs: 60_000 })
  async recordVisit(@Req() request: any, @Param('spotId') spotId: string) {
    try {
      return await this.recordGeoHelpSpotVisitUseCase.execute({
        spotId,
        userId: request.user?.userId,
      });
    } catch (error) {
      this.rethrowGeoHelpBoardError(error);
    }
  }

  private rethrowGeoHelpBoardError(error: unknown): never {
    if (error instanceof GeoHelpBoardError) {
      if (error.code === 'NOT_FOUND') {
        throw new NotFoundException(error.message);
      }

      if (error.code === 'FORBIDDEN') {
        throw new HttpException(error.message, HttpStatus.FORBIDDEN);
      }

      if (error.code === 'CONFLICT') {
        throw new HttpException(error.message, HttpStatus.CONFLICT);
      }

      throw new BadRequestException(error.message);
    }

    if (error instanceof Error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    throw new HttpException('Unexpected geo help board error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

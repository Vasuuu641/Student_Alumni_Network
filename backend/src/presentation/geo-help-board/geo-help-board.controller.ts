import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtStrategy } from '../../auth/jwt.strategy';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

import { CreateGeoHelpSpotUseCase } from '../../application/geo-help-board/create-geo-help-spot.usecase';
import { ListPopularGeoHelpSpotsUseCase } from '../../application/geo-help-board/list-popular-geo-help-spots.usecase';
import { ListNearbyGeoHelpSpotsUseCase } from '../../application/geo-help-board/list-nearby-geo-help-spots.usecase';
import { RecordGeoHelpSpotVisitUseCase } from '../../application/geo-help-board/record-geo-help-spot-visit.usecase';

import { CreateGeoHelpSpotDto } from './dto/create-geo-help-spot.dto';
import { ListPopularGeoHelpSpotsQueryDto } from './dto/list-popular-geo-help-spots-query.dto';
import { ListNearbyGeoHelpSpotsQueryDto } from './dto/list-nearby-geo-help-spots-query.dto';

@Controller('geo-help-board')
@UseGuards(JwtStrategy, RolesGuard)
@Roles('STUDENT', 'PROFESSOR')
export class GeoHelpBoardController {
  constructor(
    private readonly createGeoHelpSpotUseCase: CreateGeoHelpSpotUseCase,
    private readonly listPopularGeoHelpSpotsUseCase: ListPopularGeoHelpSpotsUseCase,
    private readonly listNearbyGeoHelpSpotsUseCase: ListNearbyGeoHelpSpotsUseCase,
    private readonly recordGeoHelpSpotVisitUseCase: RecordGeoHelpSpotVisitUseCase,
  ) {}

  @Get('spots/popular')
  async listPopular(@Query() query: ListPopularGeoHelpSpotsQueryDto) {
    return this.listPopularGeoHelpSpotsUseCase.execute({
      city: query.city,
      category: query.category as any,
      limit: query.limit,
    });
  }

  @Get('spots/nearby')
  async listNearby(@Query() query: ListNearbyGeoHelpSpotsQueryDto) {
    return this.listNearbyGeoHelpSpotsUseCase.execute({
      latitude: query.latitude,
      longitude: query.longitude,
      radiusKm: query.radiusKm,
      city: query.city,
      category: query.category as any,
      limit: query.limit,
    });
  }

  @Post('spots')
  async createSpot(@Req() request: any, @Body() body: CreateGeoHelpSpotDto) {
    const createdById = request.user?.userId;

    return this.createGeoHelpSpotUseCase.execute({
      title: body.title,
      description: body.description,
      city: body.city,
      address: body.address,
      latitude: body.latitude,
      longitude: body.longitude,
      category: body.category as any,
      createdById,
    });
  }

  @Post('spots/:spotId/visit')
  async recordVisit(@Req() request: any, @Param('spotId') spotId: string) {
    return this.recordGeoHelpSpotVisitUseCase.execute({
      spotId,
      userId: request.user?.userId,
    });
  }
}

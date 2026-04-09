import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

import { GeoHelpBoardController } from './geo-help-board.controller';

import { CreateGeoHelpSpotUseCase } from '../../application/geo-help-board/create-geo-help-spot.usecase';
import { EditGeoHelpSpotUseCase } from '../../application/geo-help-board/edit-geo-help-spot.usecase';
import { DeactivateGeoHelpSpotUseCase } from '../../application/geo-help-board/deactivate-geo-help-spot.usecase';
import { VerifyGeoHelpSpotUseCase } from '../../application/geo-help-board/verify-geo-help-spot.usecase';
import { ListPopularGeoHelpSpotsUseCase } from '../../application/geo-help-board/list-popular-geo-help-spots.usecase';
import { ListNearbyGeoHelpSpotsUseCase } from '../../application/geo-help-board/list-nearby-geo-help-spots.usecase';
import { RecordGeoHelpSpotVisitUseCase } from '../../application/geo-help-board/record-geo-help-spot-visit.usecase';

import { PrismaGeoHelpBoardRepository } from '../../infrastructure/repositories/prisma-geo-help-board.repository';
import { RateLimitGuard } from '../../infrastructure/security/rate-limit.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [GeoHelpBoardController],
  providers: [
    CreateGeoHelpSpotUseCase,
    EditGeoHelpSpotUseCase,
    DeactivateGeoHelpSpotUseCase,
    VerifyGeoHelpSpotUseCase,
    ListPopularGeoHelpSpotsUseCase,
    ListNearbyGeoHelpSpotsUseCase,
    RecordGeoHelpSpotVisitUseCase,
    RateLimitGuard,

    PrismaGeoHelpBoardRepository,
    { provide: 'GeoHelpBoardRepository', useClass: PrismaGeoHelpBoardRepository },
  ],
})
export class GeoHelpBoardModule {}

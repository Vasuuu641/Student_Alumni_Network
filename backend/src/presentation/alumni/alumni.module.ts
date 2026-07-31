import { Module } from '@nestjs/common';
import { AlumniController } from './alumni.controller';
import { GetAlumniProfileUseCase } from '../../application/alumni/get-alumni-profile.usecase';
import { UpdateAlumniProfileUseCase } from '../../application/alumni/update-alumni-profile.usecase';
import { PrismaAlumniRepository } from '../../infrastructure/repositories/prisma-alumni.repository';
import { PrismaUserRepository } from '../../infrastructure/repositories/prisma-user.repository';
import { PrismaUserInterestProfileRepository } from '../../infrastructure/repositories/prisma-user-interest.repository';
import { R2FileStorageService } from '../../infrastructure/services/file-storage.service';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AlumniController],
  providers: [
    GetAlumniProfileUseCase,
    UpdateAlumniProfileUseCase,
    PrismaAlumniRepository,
    PrismaUserRepository,
    PrismaUserInterestProfileRepository,
    R2FileStorageService,
    { provide: 'AlumniRepository', useClass: PrismaAlumniRepository },
    { provide: 'UserRepository', useClass: PrismaUserRepository },
    { provide: 'UserInterestProfileRepository', useClass: PrismaUserInterestProfileRepository },
    { provide: 'FileStorageService', useClass: R2FileStorageService },
  ],
})
export class AlumniModule {}

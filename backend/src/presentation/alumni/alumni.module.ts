import { Module } from '@nestjs/common';
import { AlumniController } from './alumni.controller';
import { GetAlumniProfileUseCase } from '../../application/alumni/get-alumni-profile.usecase';
import { UpdateAlumniProfileUseCase } from '../../application/alumni/update-alumni-profile.usecase';
import { PrismaAlumniRepository } from '../../infrastructure/repositories/prisma-alumni.repository';
import { PrismaUserRepository } from '../../infrastructure/repositories/prisma-user.repository';
import { PrismaUserInterestProfileRepository } from '../../infrastructure/repositories/prisma-user-interest.repository';
import { LocalFileStorageService } from '../../infrastructure/services/local-file-storage.service';
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
    LocalFileStorageService,
    { provide: 'AlumniRepository', useClass: PrismaAlumniRepository },
    { provide: 'UserRepository', useClass: PrismaUserRepository },
    { provide: 'UserInterestProfileRepository', useClass: PrismaUserInterestProfileRepository },
    { provide: 'FileStorageService', useClass: LocalFileStorageService },
  ],
})
export class AlumniModule {}

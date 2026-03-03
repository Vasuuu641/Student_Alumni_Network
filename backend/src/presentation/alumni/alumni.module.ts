import { Module } from '@nestjs/common';
import { AlumniController } from './alumni.controller';
import { GetAlumniProfileUseCase } from '../../application/alumni/get-alumni-profile.usecase';
import { UpdateAlumniProfileUseCase } from '../../application/alumni/update-alumni-profile.usecase';
import { PrismaAlumniRepository } from '../../infrastructure/repositories/prisma-alumni.repository';
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
    LocalFileStorageService,
    { provide: 'AlumniRepository', useClass: PrismaAlumniRepository },
    { provide: 'FileStorageService', useClass: LocalFileStorageService },
  ],
})
export class AlumniModule {}

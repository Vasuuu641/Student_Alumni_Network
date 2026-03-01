import { Module } from '@nestjs/common';
import { AlumniController } from './alumni.controller';
import { UpdateAlumniProfileUseCase } from '../../application/alumni/update-alumni-profile.usecase';
import { PrismaAlumniRepository } from '../../infrastructure/repositories/prisma-alumni.repository';
import { LocalFileStorageService } from '../../infrastructure/services/local-file-storage.service';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AlumniController],
  providers: [
    UpdateAlumniProfileUseCase,
    PrismaAlumniRepository,
    LocalFileStorageService,
    { provide: 'AlumniRepository', useClass: PrismaAlumniRepository },
    { provide: 'FileStorageService', useClass: LocalFileStorageService },
  ],
})
export class AlumniModule {}

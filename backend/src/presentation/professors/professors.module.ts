import {Module} from '@nestjs/common';
import { ProfessorsController } from './professors.controller';
import { GetProfessorProfileUseCase } from '../../application/professors/get-professor-profile.usecase';
import { UpdateProfessorProfileUseCase } from '../../application/professors/update-professor-profile.usecase';
import { PrismaProfessorRepository } from '../../infrastructure/repositories/prisma-professor.repository';
import { PrismaUserRepository } from '../../infrastructure/repositories/prisma-user.repository';
import { LocalFileStorageService } from '../../infrastructure/services/local-file-storage.service';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ProfessorsController],
  providers: [
    GetProfessorProfileUseCase,
    UpdateProfessorProfileUseCase,
    PrismaProfessorRepository,
    PrismaUserRepository,
    LocalFileStorageService,
    { provide: 'ProfessorRepository', useClass: PrismaProfessorRepository },
    { provide: 'UserRepository', useClass: PrismaUserRepository },
    { provide: 'FileStorageService', useClass: LocalFileStorageService },
  ],
})
export class ProfessorsModule {}
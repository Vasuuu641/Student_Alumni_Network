import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { GetStudentProfileUseCase } from '../../application/students/get-student-profile-usecase';
import { UpdateStudentProfileUseCase } from '../../application/students/update-student-profile.usecase';
import { PrismaStudentRepository } from '../../infrastructure/repositories/prisma-student.repository';
import { PrismaUserRepository } from '../../infrastructure/repositories/prisma-user.repository';
import { PrismaUserInterestProfileRepository } from '../../infrastructure/repositories/prisma-user-interest.repository';
import { LocalFileStorageService } from '../../infrastructure/services/local-file-storage.service';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StudentsController],
  providers: [
    GetStudentProfileUseCase,
    UpdateStudentProfileUseCase,
    PrismaStudentRepository,
    PrismaUserRepository,
    PrismaUserInterestProfileRepository,
    LocalFileStorageService,
    { provide: 'StudentRepository', useClass: PrismaStudentRepository },
    { provide: 'UserRepository', useClass: PrismaUserRepository },
    { provide: 'UserInterestProfileRepository', useClass: PrismaUserInterestProfileRepository },
    { provide: 'FileStorageService', useClass: LocalFileStorageService },
  ],
})
export class StudentsModule {}
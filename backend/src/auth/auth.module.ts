//Auth module code goes here

import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RolesGuard } from './roles.guard';
import { RegisterUserUseCase } from '../application/auth/register-user.usecase';
import { LoginUserUseCase } from '../application/auth/login-user.usecase';
import { JwtStrategy } from './jwt.strategy';
import { PrismaUserRepository } from '../infrastructure/repositories/prisma-user.repository';
import { PrismaAuthorizedUserRepository } from '../infrastructure/repositories/prisma-authorized-user.repository';
import { PrismaStudentRepository } from '../infrastructure/repositories/prisma-student.repository';
import { PrismaAlumniRepository } from '../infrastructure/repositories/prisma-alumni.repository';
import { PrismaProfessorRepository } from '../infrastructure/repositories/prisma-professor.repository';
import { BcryptPasswordHasher } from '../infrastructure/security/bcrypt-password-hasher';
import { JwtTokenService } from '../infrastructure/security/jwt-token-service';
import { PrismaModule } from '../infrastructure/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    PrismaUserRepository,
    PrismaAuthorizedUserRepository,
    PrismaStudentRepository,
    PrismaAlumniRepository,
    PrismaProfessorRepository,
    AuthService,
    RolesGuard,
    JwtStrategy,
    RegisterUserUseCase,
    LoginUserUseCase,
    { provide: 'UserRepository', useClass: PrismaUserRepository },
    { provide: 'AuthorizedUserRepository', useClass: PrismaAuthorizedUserRepository },
    { provide: 'StudentRepository', useClass: PrismaStudentRepository },
    { provide: 'AlumniRepository', useClass: PrismaAlumniRepository },
    { provide: 'ProfessorRepository', useClass: PrismaProfessorRepository },
    { provide: 'PasswordHasher', useClass: BcryptPasswordHasher },
    {
      provide: 'TokenService',
      useFactory: () =>
        new JwtTokenService(
          process.env.JWT_SECRET ?? 'dev-secret',
          process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'dev-refresh-secret'
        ),
    },
  ],
  exports: ['TokenService', JwtStrategy, RolesGuard],
})
export class AuthModule {}  
//Auth module code goes here

import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RolesGuard } from './roles.guard';
import { RegisterUserUseCase } from '../application/auth/register-user.usecase';
import { LoginUserUseCase } from '../application/auth/login-user.usecase';
import { LogoutUserUseCase } from '../application/auth/logout-user.usecase';
import { RequestPasswordResetUseCase } from '../application/auth/request-password-reset.usecase';
import { ResetPasswordUseCase } from '../application/auth/reset-password-usecase';
import { JwtStrategy } from './jwt.strategy';
import { PrismaUserRepository } from '../infrastructure/repositories/prisma-user.repository';
import { PrismaAuthorizedUserRepository } from '../infrastructure/repositories/prisma-authorized-user.repository';
import { PrismaStudentRepository } from '../infrastructure/repositories/prisma-student.repository';
import { PrismaAlumniRepository } from '../infrastructure/repositories/prisma-alumni.repository';
import { PrismaProfessorRepository } from '../infrastructure/repositories/prisma-professor.repository';
import { PrismaRevokedTokenRepository } from '../infrastructure/repositories/prisma-revoked-token.repository';
import { PrismaPasswordResetOtpRepository } from '../infrastructure/repositories/prisma-password-reset-otp.repository';
import { BcryptPasswordHasher } from '../infrastructure/security/bcrypt-password-hasher';
import { JwtTokenService } from '../infrastructure/security/jwt-token-service';
import { PrismaModule } from '../infrastructure/database/prisma/prisma.module';
import { ResendEmailService } from '../infrastructure/services/email/resend-email.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    PrismaUserRepository,
    PrismaAuthorizedUserRepository,
    PrismaStudentRepository,
    PrismaAlumniRepository,
    PrismaProfessorRepository,
    PrismaRevokedTokenRepository,
    PrismaPasswordResetOtpRepository,
    AuthService,
    RolesGuard,
    JwtStrategy,
    RegisterUserUseCase,
    LoginUserUseCase,
    LogoutUserUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    { provide: 'UserRepository', useClass: PrismaUserRepository },
    { provide: 'AuthorizedUserRepository', useClass: PrismaAuthorizedUserRepository },
    { provide: 'StudentRepository', useClass: PrismaStudentRepository },
    { provide: 'AlumniRepository', useClass: PrismaAlumniRepository },
    { provide: 'ProfessorRepository', useClass: PrismaProfessorRepository },
    { provide: 'RevokedTokenRepository', useClass: PrismaRevokedTokenRepository },
    { provide: 'PasswordResetOtpRepository', useClass: PrismaPasswordResetOtpRepository },
    { provide: 'PasswordHasher', useClass: BcryptPasswordHasher },
    { provide: 'EmailService', useClass: ResendEmailService },
    {
      provide: 'TokenService',
      useFactory: () => {
        const jwtSecret = process.env.JWT_SECRET;
        const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

        if (!jwtSecret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        if (!jwtRefreshSecret) {
          throw new Error('JWT_REFRESH_SECRET environment variable is required');
        }

        return new JwtTokenService(jwtSecret, jwtRefreshSecret);
      },
    },
  ],
  exports: ['TokenService', JwtStrategy, RolesGuard, 'UserRepository'],
})
export class AuthModule {}
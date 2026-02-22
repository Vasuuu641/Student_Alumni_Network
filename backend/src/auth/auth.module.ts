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
import { BcryptPasswordHasher } from '../infrastructure/security/bcrypt-password-hasher';
import { JwtTokenService } from '../infrastructure/security/jwt-token-service';
import { PrismaModule } from '../infrastructure/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    PrismaUserRepository,
    PrismaAuthorizedUserRepository,
    AuthService,
    RolesGuard,
    JwtStrategy,
    RegisterUserUseCase,
    LoginUserUseCase,
    { provide: 'UserRepository', useClass: PrismaUserRepository },
    { provide: 'AuthorizedUserRepository', useClass: PrismaAuthorizedUserRepository },
    { provide: 'PasswordHasher', useClass: BcryptPasswordHasher },
    {
      provide: 'TokenService',
      useFactory: () => new JwtTokenService(process.env.JWT_SECRET ?? 'dev-secret'),
    },
  ],
  exports: ['TokenService', JwtStrategy, RolesGuard],
})
export class AuthModule {}  
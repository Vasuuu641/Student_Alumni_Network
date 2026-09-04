/*This service:
Calls RegisterUseCase
Calls LoginUseCase
Calls TokenService
Returns JWT*/

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { RegisterUserUseCase } from '../application/auth/register-user.usecase';
import { LoginUserUseCase } from '../application/auth/login-user.usecase';
import { LogoutUserUseCase } from '../application/auth/logout-user.usecase';
import { User } from '../domain/entities/user.entity';
import type { TokenService } from '../domain/services/token-service';
import type { UserRepository } from '../domain/repositories/user.repository';
import type { RevokedTokenRepository } from '../domain/repositories/revoked-token.repository';
import { RegisterRequestDto } from './dto/register-request.dto';
import { LoginRequestDto } from './dto/login-request.dto';

@Injectable()
export class AuthService {
  constructor(
    private registerUserUseCase: RegisterUserUseCase,
    private loginUserUseCase: LoginUserUseCase,
    private logoutUserUseCase: LogoutUserUseCase,
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('TokenService')
    private tokenService: TokenService,
    @Inject('RevokedTokenRepository')
    private revokedTokenRepository: RevokedTokenRepository,
  ) {}

  async register(request: RegisterRequestDto) {
    const user = await this.registerUserUseCase.execute(request);
    return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role
  };
  }

  async login(request: LoginRequestDto) {
    const { email, password } = request;
    const user = await this.loginUserUseCase.execute(email, password);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    const tokens = this.issueTokens(user.id, user.role as any);
    return tokens;
  }

  async refresh(refreshToken: string) {
    // 1. Reject if the token was already explicitly revoked
    const revoked = await this.revokedTokenRepository.isRevoked(refreshToken);
    if (revoked) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // 2. Verify signature & expiry
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);

    // 3. Refresh-token rotation: revoke the used token …
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.revokedTokenRepository.revoke(refreshToken, payload.userId, expiresAt);

    // 4. … then issue a fresh pair
    return this.issueTokens(payload.userId, payload.role);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.logoutUserUseCase.execute(refreshToken);
  }

  async getCurrentUserProfile(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    return this.toProfileResponse(user);
  }

  async updateCurrentUserProfile(
    userId: string,
    request: { firstName?: string; lastName?: string },
  ) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const nextFirstName = request.firstName?.trim();
    const nextLastName = request.lastName?.trim();

    if (nextFirstName) {
      user.firstName = nextFirstName;
    }

    if (nextLastName) {
      user.lastName = nextLastName;
    }

    const updatedUser = await this.userRepository.update(user);
    return this.toProfileResponse(updatedUser);
  }

  private issueTokens(userId: string, role: any) {
    const accessToken = this.tokenService.generateAccessToken({ userId, role });
    const refreshToken = this.tokenService.generateRefreshToken({ userId, role });
    return { accessToken, refreshToken };
  }

  private toProfileResponse(user: User) {
    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }
}
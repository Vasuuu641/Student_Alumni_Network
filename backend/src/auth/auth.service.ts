/*This service:
Calls RegisterUseCase
Calls LoginUseCase
Calls TokenService
Returns JWT*/

import { Inject, Injectable } from '@nestjs/common';
import { RegisterUserUseCase } from '../application/auth/register-user.usecase';
import { LoginUserUseCase } from '../application/auth/login-user.usecase';
import type { TokenService } from '../domain/services/token-service';
import { RegisterRequestDto } from './dto/register-request.dto';
import { LoginRequestDto } from './dto/login-request.dto';

@Injectable()
export class AuthService {
  constructor(
    private registerUserUseCase: RegisterUserUseCase,
    private loginUserUseCase: LoginUserUseCase,
    @Inject('TokenService')
    private tokenService: TokenService
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
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);
    const tokens = this.issueTokens(payload.userId, payload.role);
    return tokens;
  }

  private issueTokens(userId: string, role: any) {
    const accessToken = this.tokenService.generateAccessToken({ userId, role });
    const refreshToken = this.tokenService.generateRefreshToken({ userId, role });
    return { accessToken, refreshToken };
  }
}
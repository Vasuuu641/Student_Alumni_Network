/*This service:

Calls RegisterUseCase

Calls LoginUseCase

Calls TokenService

Returns JWT*/

import { Injectable } from '@nestjs/common';
import { RegisterUserUseCase } from '../application/auth/register-user.usecase';
import { LoginUserUseCase } from '../application/auth/login-user.usecase';
import type { TokenService } from '../domain/services/token-service';

@Injectable()
export class AuthService {
  constructor(
    private registerUserUseCase: RegisterUserUseCase,
    private loginUserUseCase: LoginUserUseCase,
    private tokenService: TokenService
  ) {}

  async register(request: any) {
    const user = await this.registerUserUseCase.execute(request);
    return user;
  }

  async login(request: any) {
    const { email, password } = request;
    const user = await this.loginUserUseCase.execute(email, password);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    const token = this.tokenService.generateToken({ userId: user.id });
    return { token };
  }
}
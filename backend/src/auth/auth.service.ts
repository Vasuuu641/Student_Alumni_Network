/*This service:
Calls RegisterUseCase
Calls LoginUseCase
Calls TokenService
Returns JWT*/

import { Injectable } from '@nestjs/common';
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
    const token = this.tokenService.generateToken(
      { userId: user.id, role: user.role },
      process.env.JWT_EXPIRES_IN ?? '1h'
    );
    return { token };
  }
}
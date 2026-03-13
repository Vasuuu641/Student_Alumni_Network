import { Controller, Post, Body, HttpException, HttpStatus, BadRequestException, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterRequestDto } from './dto/register-request.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { RefreshTokenRequestDto } from './dto/refresh-token-request.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() request: RegisterRequestDto) {
    try {
      return await this.authService.register(request);
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        throw new BadRequestException('User already exists');
      }
      if (error.message.includes('not authorized')) {
        throw new BadRequestException('Email not authorized');
      }
      if (error.message.includes('already used')) {
        throw new BadRequestException('Email already used');
      }
      if (error.message.includes('Invalid email format')) {
        throw new BadRequestException(error.message);
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('login')
  async login(@Body() request: LoginRequestDto) {
  try {
    return await this.authService.login(request);
  } catch (error: any) {
    if (error.message.includes('Invalid credentials')) {
      throw new BadRequestException('Invalid credentials');
    }
    throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
 }

  @Post('refresh')
  async refresh(@Body() request: RefreshTokenRequestDto) {
    try {
      return await this.authService.refresh(request.refreshToken);
    } catch (error: any) {
      if (
        error.message?.includes('Invalid token') ||
        error.message?.includes('revoked') ||
        error.status === 401
      ) {
        throw new BadRequestException('Invalid or revoked refresh token');
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /** Revokes the provided refresh token. Idempotent – safe to call multiple times. */
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() request: RefreshTokenRequestDto) {
    try {
      await this.authService.logout(request.refreshToken);
    } catch (error: any) {
      if (error.status === 401 || error.message?.includes('Invalid')) {
        throw new BadRequestException('Invalid or expired refresh token');
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
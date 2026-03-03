import { Controller, Post, Body, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterRequestDto } from './dto/register-request.dto';
import { LoginRequestDto } from './dto/login-request.dto';

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
}
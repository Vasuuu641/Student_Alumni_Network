//Call the methods from the use cases and return the response to the client

import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() request: any) {
    return this.authService.register(request);
  }

  @Post('login')
  async login(@Body() request: any) {
    return this.authService.login(request);
  }
}
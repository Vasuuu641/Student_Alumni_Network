/*Validate:

Extract token

Verify signature

Attach payload to request*/

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import type { TokenService } from '../domain/services/token-service';

@Injectable()
export class JwtStrategy implements CanActivate {
  constructor(private tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      return false;
    }
    const token = authHeader.split(' ')[1];
    try {
      const payload = await this.tokenService.verifyToken(token);
      request.user = payload; // Attach payload to request
      return true;
    } catch (error) {
      return false;
    }
  }
}
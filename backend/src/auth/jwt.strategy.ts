/*Validate:
Extract token
Verify signature
Attach payload to request*/

import { Inject, Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { TokenService } from '../domain/services/token-service';

@Injectable()
export class JwtStrategy implements CanActivate {
  constructor(@Inject('TokenService') private tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization header');
    }
    try {
      const payload = await this.tokenService.verifyToken(token);
      request.user = payload; // Attach payload to request
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
import { Role } from '../entities/authorized-user.entity';

export interface AuthPayload {
  userId: string;
  role: Role;
  tokenType?: 'access' | 'refresh';
}

export interface TokenService {
  generateAccessToken(payload: AuthPayload): string;
  generateRefreshToken(payload: AuthPayload): string;
  verifyAccessToken(token: string): Promise<AuthPayload>;
  verifyRefreshToken(token: string): Promise<AuthPayload>;
}
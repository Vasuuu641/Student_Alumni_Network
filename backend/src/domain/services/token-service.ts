import { Role } from '../entities/authorized-user.entity';

export interface AuthPayload {
  userId: string;
  role: Role;
}

export interface TokenService {
  generateToken(payload: any, expiresIn?: string | number): string;
  verifyToken(token: string): Promise<any>;
}
export interface TokenService {
  generateToken(payload: any): string;
  verifyToken(token: string): Promise<any>;
}
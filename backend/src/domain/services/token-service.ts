export interface TokenService {
  generateToken(payload: any): string;
}
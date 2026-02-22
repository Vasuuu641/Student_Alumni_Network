import jwt, { Secret } from 'jsonwebtoken';
import type { TokenService } from '../../domain/services/token-service';

export class JwtTokenService implements TokenService {
    private secretKey: Secret;

    constructor(secretKey: string) {
        this.secretKey = secretKey as Secret;
    }

    generateToken(payload: string | object | Buffer, expiresIn?: string | number): string {
        const options = expiresIn !== undefined ? { expiresIn: expiresIn as any } : undefined;
        return jwt.sign(payload, this.secretKey, options);
    }

    async verifyToken(token: string): Promise<object | string> {
        try {
            return jwt.verify(token, this.secretKey);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
}
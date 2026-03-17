import jwt, { Secret } from 'jsonwebtoken';
import type { AuthPayload, TokenService } from '../../domain/services/token-service';

export class JwtTokenService implements TokenService {
    private accessSecretKey: Secret;
    private refreshSecretKey: Secret;
    private accessExpiresIn: string | number;
    private refreshExpiresIn: string | number;

    constructor(accessSecretKey: string, refreshSecretKey: string) {
        this.accessSecretKey = accessSecretKey as Secret;
        this.refreshSecretKey = refreshSecretKey as Secret;
        this.accessExpiresIn = process.env.JWT_EXPIRES_IN ?? '1h';
        this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '24h';
    }

    generateAccessToken(payload: AuthPayload): string {
        return jwt.sign(
            { ...payload, tokenType: 'access' },
            this.accessSecretKey,
            { expiresIn: this.accessExpiresIn as any }
        );
    }

    generateRefreshToken(payload: AuthPayload): string {
        return jwt.sign(
            { ...payload, tokenType: 'refresh' },
            this.refreshSecretKey,
            { expiresIn: this.refreshExpiresIn as any }
        );
    }

    async verifyAccessToken(token: string): Promise<AuthPayload> {
        try {
            const payload = jwt.verify(token, this.accessSecretKey) as AuthPayload;
            if (payload?.tokenType && payload.tokenType !== 'access') {
                throw new Error('Invalid token type');
            }
            return payload;
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    async verifyRefreshToken(token: string): Promise<AuthPayload> {
        try {
            const payload = jwt.verify(token, this.refreshSecretKey) as AuthPayload;
            if (payload?.tokenType && payload.tokenType !== 'refresh') {
                throw new Error('Invalid token type');
            }
            return payload;
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
}
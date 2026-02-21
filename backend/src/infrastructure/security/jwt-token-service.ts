import jwt, { Secret } from 'jsonwebtoken';

export interface IJwtService {
    generateToken(payload: string | object | Buffer, expiresIn: string | number | undefined): string;
    verifyToken(token: string): object | string;
}

export class JwtService implements IJwtService {
    private secretKey: Secret;

    constructor(secretKey: string) {
        this.secretKey = secretKey as Secret;
    }

    generateToken(payload: string | object | Buffer, expiresIn: string | number | undefined): string {
        const options = expiresIn !== undefined ? { expiresIn: expiresIn as any } : undefined;
        return jwt.sign(payload, this.secretKey, options);
    }

    verifyToken(token: string): object | string {
        try {
            return jwt.verify(token, this.secretKey);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
}
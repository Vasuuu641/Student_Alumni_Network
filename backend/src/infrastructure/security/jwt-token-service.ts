import jwt from 'jsonwebtoken';

export interface IJwtService {
    generateToken(payload: object, expiresIn: string): string;
    verifyToken(token: string): object | string;
}

export class JwtService implements IJwtService {
    private secretKey: string;

    constructor(secretKey: string) {
        this.secretKey = secretKey;
    }

    generateToken(payload: object, expiresIn: string): string {
        return jwt.sign(payload, this.secretKey, { expiresIn });
    }

    verifyToken(token: string): object | string {
        try {
            return jwt.verify(token, this.secretKey);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
}
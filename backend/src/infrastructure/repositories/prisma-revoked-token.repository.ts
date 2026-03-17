import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import type { RevokedTokenRepository } from '../../domain/repositories/revoked-token.repository';

@Injectable()
export class PrismaRevokedTokenRepository implements RevokedTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async revoke(token: string, userId: string, expiresAt: Date): Promise<void> {
    await this.prisma.revokedToken.upsert({
      where: { token },
      create: { token, userId, expiresAt },
      update: {},           // already revoked – no-op
    });
  }

  async isRevoked(token: string): Promise<boolean> {
    const row = await this.prisma.revokedToken.findUnique({
      where: { token },
    });
    return row !== null;
  }

  async deleteExpired(): Promise<void> {
    await this.prisma.revokedToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}

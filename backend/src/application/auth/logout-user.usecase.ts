import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { TokenService } from '../../domain/services/token-service';
import type { RevokedTokenRepository } from '../../domain/repositories/revoked-token.repository';

/**
 * Invalidates a refresh token so it can never be used again.
 *
 * Flow:
 *  1. Verify the token is a valid refresh token (not expired, right type).
 *  2. Check it hasn't already been revoked (idempotent logout support).
 *  3. Insert it into the RevokedToken blocklist with its natural expiry TTL.
 */
@Injectable()
export class LogoutUserUseCase {
  constructor(
    @Inject('TokenService')
    private readonly tokenService: TokenService,
    @Inject('RevokedTokenRepository')
    private readonly revokedTokenRepository: RevokedTokenRepository,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    // 1. Validate – throws if expired or tampered
    let payload: Awaited<ReturnType<TokenService['verifyRefreshToken']>>;
    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      // Already invalid – nothing useful to revoke, treat as success
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // 2. Idempotent: already revoked → done
    const alreadyRevoked = await this.revokedTokenRepository.isRevoked(refreshToken);
    if (alreadyRevoked) return;

    // 3. Store in blocklist. TTL = 24 h from now (safe upper bound).
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.revokedTokenRepository.revoke(refreshToken, payload.userId, expiresAt);
  }
}

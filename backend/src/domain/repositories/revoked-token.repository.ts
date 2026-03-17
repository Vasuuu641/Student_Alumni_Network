export interface RevokedTokenRepository {
  /**
   * Add a refresh token to the blocklist so it can never be used again.
   * @param token  The raw refresh token string.
   * @param userId The owner of the token (for audit / cleanup queries).
   * @param expiresAt When the token would have expired naturally – used for DB clean-up.
   */
  revoke(token: string, userId: string, expiresAt: Date): Promise<void>;

  /**
   * Returns true if the token has been explicitly revoked (i.e. exists in the blocklist).
   */
  isRevoked(token: string): Promise<boolean>;

  /**
   * Housekeeping: delete blocklist rows whose natural expiry has already passed.
   * Call periodically (e.g. via a cron job) to keep the table small.
   */
  deleteExpired(): Promise<void>;
}

export class PasswordResetOtp {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly codeHash: string,
    public readonly expiresAt: Date,
    public attempts: number = 0,
    public consumed: boolean = false,
  ) {}

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  hasExceededAttempts(maxAttempts = 5): boolean {
    return this.attempts >= maxAttempts;
  }

  isValid(): boolean {
    return !this.consumed && !this.isExpired() && !this.hasExceededAttempts();
  }

  registerFailedAttempt(): void {
    this.attempts += 1;
  }

  markConsumed(): void {
    this.consumed = true;
  }
}
import { Inject, Injectable } from '@nestjs/common';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { PasswordResetOtpRepository } from '../../domain/repositories/password-reset-otp.repository';
import type { PasswordHasher } from '../../domain/services/password-hasher';
import { Email } from '../../domain/value-objects/email.vo';
import * as crypto from 'crypto';

export class InvalidOtpError extends Error {
  constructor() {
    super('Invalid or expired OTP');
  }
}

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('PasswordResetOtpRepository')
    private readonly otpRepository: PasswordResetOtpRepository,
    @Inject('PasswordHasher')
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(email: string, code: string, newPassword: string): Promise<void> {
    const emailVO = new Email(email);
    const otp = await this.otpRepository.findLatestActiveByEmail(emailVO.getValue());

    if (!otp || !otp.isValid()) {
      throw new InvalidOtpError();
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    if (codeHash !== otp.codeHash) {
      otp.registerFailedAttempt();
      await this.otpRepository.update(otp);
      throw new InvalidOtpError();
    }

    const user = await this.userRepository.findByEmail(emailVO);
    if (!user) {
      throw new InvalidOtpError(); // generic error — don't leak state
    }

    const hashedPassword = await this.passwordHasher.hash(newPassword);
    user.changePassword(hashedPassword);
    await this.userRepository.update(user);

    otp.markConsumed();
    await this.otpRepository.update(otp);
  }
}
import { Inject, Injectable } from '@nestjs/common';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { PasswordResetOtpRepository } from '../../domain/repositories/password-reset-otp.repository';
import type { EmailService } from '../../domain/services/email.service';
import { PasswordResetOtp } from '../../domain/entities/password-reset-otp.entity';
import { Email } from '../../domain/value-objects/email.vo';
import * as crypto from 'crypto';

const OTP_TTL_MINUTES = 10;

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('PasswordResetOtpRepository')
    private readonly otpRepository: PasswordResetOtpRepository,
    @Inject('EmailService')
    private readonly emailService: EmailService,
  ) {}

  async execute(email: string): Promise<void> {
    const emailVO = new Email(email);
    const user = await this.userRepository.findByEmail(emailVO);

    // Don't leak whether the email exists — always resolve the same way.
    if (!user) return;

    // Invalidate any previous outstanding OTPs for this email.
    await this.otpRepository.invalidateAllForEmail(emailVO.getValue());

    const code = this.generateOtp();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    const otp = new PasswordResetOtp(
      undefined as any, // assigned by Prisma on create
      emailVO.getValue(),
      codeHash,
      expiresAt,
    );

    await this.otpRepository.create(otp);
    await this.emailService.sendPasswordResetOtp(emailVO.getValue(), code);
  }

  private generateOtp(): string {
    return crypto.randomInt(100000, 1000000).toString(); // 6 digits
  }
}
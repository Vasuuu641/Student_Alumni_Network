import { PasswordResetOtp } from '../entities/password-reset-otp.entity';

export interface PasswordResetOtpRepository {
  create(otp: PasswordResetOtp): Promise<PasswordResetOtp>;
  findLatestActiveByEmail(email: string): Promise<PasswordResetOtp | null>;
  update(otp: PasswordResetOtp): Promise<void>;
  invalidateAllForEmail(email: string): Promise<void>;
}
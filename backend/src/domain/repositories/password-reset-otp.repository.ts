import { PasswordResetOtp } from '../entities/password-reset-otp.entity';

export interface PasswordResetOtpRepository {
  findById(id: string): Promise<PasswordResetOtp | null>;
  findLatestActiveByEmail(email: string): Promise<PasswordResetOtp | null>;
  create(otp: PasswordResetOtp): Promise<PasswordResetOtp>;
  update(otp: PasswordResetOtp): Promise<PasswordResetOtp>;
  invalidateAllForEmail(email: string): Promise<void>;
  delete(id: string): Promise<void>;
}
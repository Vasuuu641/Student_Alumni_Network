export interface EmailService {
  sendPasswordResetOtp(to: string, code: string): Promise<void>;
}
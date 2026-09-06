import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailService } from '../../../domain/services/email.service';

@Injectable()
export class ResendEmailService implements EmailService {
  private readonly resend: Resend;
  private readonly fromAddress: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }
    this.resend = new Resend(apiKey);
    this.fromAddress = process.env.RESEND_FROM_ADDRESS ?? 'UniBridge <no-reply@yourdomain.com>';
  }

  async sendPasswordResetOtp(to: string, code: string): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.fromAddress,
      to,
      subject: 'Your UniBridge password reset code',
      html: this.buildOtpEmailHtml(code),
    });

    if (error) {
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }
  }

  private buildOtpEmailHtml(code: string): string {
    return `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your UniBridge password</h2>
        <p>Use the code below to reset your password. This code expires in 10 minutes.</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p style="color: #666;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;
  }
}
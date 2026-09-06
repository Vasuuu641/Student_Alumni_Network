import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { PasswordResetOtpRepository } from '../../domain/repositories/password-reset-otp.repository';
import { PasswordResetOtp } from '../../domain/entities/password-reset-otp.entity';

@Injectable()
export class PrismaPasswordResetOtpRepository implements PasswordResetOtpRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(data: any): PasswordResetOtp {
    return new PasswordResetOtp(
      data.id,
      data.email,
      data.codeHash,
      data.expiresAt,
      data.attempts,
      data.consumed,
    );
  }

  async findById(id: string): Promise<PasswordResetOtp | null> {
    const record = await this.prisma.passwordResetOtp.findUnique({ where: { id } });
    return record ? this.mapToEntity(record) : null;
  }

  async findLatestActiveByEmail(email: string): Promise<PasswordResetOtp | null> {
    const record = await this.prisma.passwordResetOtp.findFirst({
      where: { email, consumed: false },
      orderBy: { createdAt: 'desc' },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async create(otp: PasswordResetOtp): Promise<PasswordResetOtp> {
    const record = await this.prisma.passwordResetOtp.create({
      data: {
        email: otp.email,
        codeHash: otp.codeHash,
        expiresAt: otp.expiresAt,
        attempts: otp.attempts,
        consumed: otp.consumed,
      },
    });
    return this.mapToEntity(record);
  }

  async update(otp: PasswordResetOtp): Promise<PasswordResetOtp> {
    const record = await this.prisma.passwordResetOtp.update({
      where: { id: otp.id },
      data: { attempts: otp.attempts, consumed: otp.consumed },
    });
    return this.mapToEntity(record);
  }

  async invalidateAllForEmail(email: string): Promise<void> {
    await this.prisma.passwordResetOtp.updateMany({
      where: { email, consumed: false },
      data: { consumed: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.passwordResetOtp.delete({ where: { id } });
  }
}
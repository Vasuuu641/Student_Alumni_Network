import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { AuthorizedUser } from '../../domain/entities/authorized-user.entity';
import { AuthorizedUserRepository } from '../../domain/repositories/authorized-user.repository';
import { Email } from '../../domain/value-objects/email.vo';

@Injectable()
export class PrismaAuthorizedUserRepository implements AuthorizedUserRepository {
    constructor(private prisma: PrismaService) {}

    private mapToEntity(data: any): AuthorizedUser {
        return new AuthorizedUser(
            data.id,
            new Email(data.email),
            data.role,
            data.createdAt,
            data.updatedAt,
            data.isUsed,
        );
    }

    async create(data: Partial<AuthorizedUser>): Promise<AuthorizedUser> {
        const result = await this.prisma.authorizedUser.create({
            data: {
                email: data.email instanceof Email ? data.email.getValue() : (data.email as unknown as string),
                role: data.role as any,
                isUsed: data.isUsed ?? false,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
            },
        });
        return this.mapToEntity(result);
    }

    async findById(id: string): Promise<AuthorizedUser | null> {
        const result = await this.prisma.authorizedUser.findUnique({
            where: { id },
        });
        return result ? this.mapToEntity(result) : null;
    }

    async findByEmail(email: Email): Promise<AuthorizedUser | null> {
        const result = await this.prisma.authorizedUser.findUnique({
            where: { email: email.getValue() },
        });
        return result ? this.mapToEntity(result) : null;
    }

    async findAll(): Promise<AuthorizedUser[]> {
        const results = await this.prisma.authorizedUser.findMany();
        return results.map(r => this.mapToEntity(r));
    }

    async update(user: AuthorizedUser): Promise<AuthorizedUser> {
        const result = await this.prisma.authorizedUser.update({
            where: { id: user.id },
            data: {
                email: user.email.getValue(),
                role: user.role,
                isUsed: user.isUsed,
                // Add other fields as necessary
            },
        });
        return this.mapToEntity(result);
    }

    async delete(id: string): Promise<void> {
        await this.prisma.authorizedUser.delete({
            where: { id },
        });
    }
}
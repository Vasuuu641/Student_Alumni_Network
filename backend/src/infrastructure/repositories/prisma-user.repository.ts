import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { Email } from '../../domain/value-objects/email.vo';
import { Role } from '../../domain/entities/user.entity';

@Injectable()
export class PrismaUserRepository implements UserRepository {
	constructor(private readonly prisma: PrismaService) {}

	async findById(id: string): Promise<User | null> {
		const record = await this.prisma.user.findUnique({ where: { id } });
		return record ? this.toDomain(record) : null;
	}

	async findByEmail(email: Email): Promise<User | null> {
		const record = await this.prisma.user.findUnique({
			where: { email: email.getValue() },
		});
		return record ? this.toDomain(record) : null;
	}

	async create(user: User): Promise<User> {
		const record = await this.prisma.user.create({
			data: {
				email: user.email.getValue(),
				password: user.password,
				firstName: user.firstName,
				lastName: user.lastName,
				role: user.role,
			},
		});
		return this.toDomain(record);
	}

	async update(user: User): Promise<User> {
		const record = await this.prisma.user.update({
			where: { id: user.id },
			data: {
				email: user.email.getValue(),
				password: user.password,
				firstName: user.firstName,
				lastName: user.lastName,
				role: user.role,
			},
		});
		return this.toDomain(record);
	}

	async delete(id: string): Promise<void> {
		await this.prisma.user.delete({ where: { id } });
	}

	private toDomain(record: {
		id: string;
		email: string;
		password: string;
		firstName: string;
		lastName: string;
		role: Role | string;
	}): User {
		return new User(
			record.id,
			new Email(record.email),
			record.password,
			record.role as Role,
			record.firstName,
			record.lastName
		);
	}
}

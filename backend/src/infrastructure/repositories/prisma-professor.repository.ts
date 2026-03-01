import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { ProfessorRepository } from '../../domain/repositories/professor.repository';
import { Professor } from '../../domain/entities/professor.entity';

@Injectable()
export class PrismaProfessorRepository implements ProfessorRepository {
	constructor(private readonly prisma: PrismaService) {}

	async findByUserId(userId: string): Promise<Professor | null> {
		const record = await this.prisma.professor.findUnique({ where: { userId } });
		return record ? this.toDomain(record) : null;
	}

	async create(professor: Professor): Promise<Professor> {
		const record = await this.prisma.professor.create({
			data: {
				userId: professor.userId,
				faculty: professor.faculty,
				jobTitle: professor.jobTitle,
				bio: professor.bio,
				interests: professor.interests,
			},
		});
		return this.toDomain(record);
	}

	async update(professor: Professor): Promise<Professor> {
		const record = await this.prisma.professor.update({
			where: { userId: professor.userId },
			data: {
				faculty: professor.faculty,
				jobTitle: professor.jobTitle,
				bio: professor.bio,
				interests: professor.interests,
			},
		});
		return this.toDomain(record);
	}

	async delete(userId: string): Promise<void> {
		await this.prisma.professor.delete({ where: { userId } });
	}

	private toDomain(record: any): Professor {
		return new Professor(
			record.userId,
			record.faculty,
			record.jobTitle,
			record.bio,
			record.interests,
		);
	}
}

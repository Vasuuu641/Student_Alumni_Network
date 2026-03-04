import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { StudentRepository } from '../../domain/repositories/student.repository';
import { Student } from '../../domain/entities/student.entity';


@Injectable()
export class PrismaStudentRepository implements StudentRepository {
	constructor(private readonly prisma: PrismaService) {}

	async findByUserId(userId: string): Promise<Student | null> {
		const record = await this.prisma.student.findUnique({ where: { userId } });
		return record ? this.toDomain(record) : null;
	}

	async create(student: Student): Promise<Student> {
		const record = await this.prisma.student.create({
			data: {
				userId: student.userId,
				major: student.major,
				yearOfGraduation: student.yearOfGraduation ?? 0,
				jobTitle: student.jobTitle,
				interests: student.interests,
				faculty: student.faculty,
				bio: student.bio,
				profilePictureUrl: student.profilePictureUrl,
			},
		});
		return this.toDomain(record);
	}

	async update(student: Student): Promise<Student> {
		const record = await this.prisma.student.update({
			where: { userId: student.userId },
			data: {
				major: student.major,
				yearOfGraduation: student.yearOfGraduation ?? 0,
				jobTitle: student.jobTitle,
				interests: student.interests,
				faculty: student.faculty,
				bio: student.bio,
				profilePictureUrl: student.profilePictureUrl,
			},
		});
		return this.toDomain(record);
	}

	async delete(userId: string): Promise<void> {
		await this.prisma.student.delete({ where: { userId } });
	}

	private toDomain(record: any): Student {
		return new Student(
			record.userId,
			record.major,
			record.yearOfGraduation ?? 0,
			record.jobTitle,
			record.interests,
			record.faculty,
			record.bio,
			record.profilePictureUrl,
		);
	}
}

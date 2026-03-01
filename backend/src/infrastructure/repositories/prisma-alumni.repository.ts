import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { AlumniRepository } from '../../domain/repositories/alumni.repository';
import { Alumni } from '../../domain/entities/alumni.entity';

@Injectable()
export class PrismaAlumniRepository implements AlumniRepository {
	constructor(private readonly prisma: PrismaService) {}

	async findByUserId(userId: string): Promise<Alumni | null> {
		const record = await this.prisma.alumni.findUnique({ where: { userId } });
		return record ? this.toDomain(record) : null;
	}

	async create(alumni: Alumni): Promise<Alumni> {
		const record = await this.prisma.alumni.create({
			data: {
				userId: alumni.userId,
				yearOfGraduation: alumni.yearOfGraduation ?? new Date().getFullYear(),
				major: alumni.major,
				company: alumni.company,
				jobTitle: alumni.jobTitle,
				bio: alumni.bio,
				interests: alumni.interests,
				profilePictureUrl: alumni.profilePictureUrl,
				isAnonymous: alumni.isAnonymous,
				anonymousName: alumni.anonymousName,
			},
		});
		return this.toDomain(record);
	}

	async update(alumni: Alumni): Promise<Alumni> {
		const record = await this.prisma.alumni.update({
			where: { userId: alumni.userId },
			data: {
				yearOfGraduation: alumni.yearOfGraduation ?? new Date().getFullYear(),
				major: alumni.major,
				company: alumni.company,
				jobTitle: alumni.jobTitle,
				bio: alumni.bio,
				interests: alumni.interests,
				profilePictureUrl: alumni.profilePictureUrl,
				isAnonymous: alumni.isAnonymous,
				anonymousName: alumni.anonymousName,
			},
		});
		return this.toDomain(record);
	}

	async delete(userId: string): Promise<void> {
		await this.prisma.alumni.delete({ where: { userId } });
	}

	private toDomain(record: any): Alumni {
		return new Alumni(
			record.userId,
			record.yearOfGraduation,
			record.major,
			record.company,
			record.jobTitle,
			record.bio,
			record.interests,
			record.profilePictureUrl,
			record.isAnonymous,
			record.anonymousName,
		);
	}
}

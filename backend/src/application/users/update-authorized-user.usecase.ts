import { Injectable, Inject } from '@nestjs/common';
import type { AuthorizedUserRepository } from '../../domain/repositories/authorized-user.repository';
import { AuthorizedUser, Role } from '../../domain/entities/authorized-user.entity';
import { Email } from '../../domain/value-objects/email.vo';

export interface UpdateAuthorizedUserRequest {
	id: string;
	email?: string;
	role?: Role;
}

@Injectable()
export class UpdateAuthorizedUserUseCase {
	constructor(
		@Inject('AuthorizedUserRepository')
		private readonly authorizedUserRepository: AuthorizedUserRepository
	) {}

	async execute(request: UpdateAuthorizedUserRequest): Promise<AuthorizedUser> {
		const { id, email, role } = request;

		const existing = await this.authorizedUserRepository.findById(id);
		if (!existing) {
			throw new Error('Authorized user not found');
		}

		// Check for email uniqueness if updating email
		if (email && email !== existing.email.getValue()) {
			const emailVO = new Email(email);
			const duplicate = await this.authorizedUserRepository.findByEmail(emailVO);
			if (duplicate) {
				throw new Error('Email already exists');
			}
		}

		// Create updated entity
		const updated = new AuthorizedUser(
			existing.id,
			email ? new Email(email) : existing.email,
			role ?? existing.role,
			existing.createdAt,
			new Date(),
			existing.isUsed
		);

		return this.authorizedUserRepository.update(updated);
	}
}

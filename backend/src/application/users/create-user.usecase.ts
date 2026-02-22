import { Injectable, Inject } from '@nestjs/common';
import type { AuthorizedUserRepository } from '../../domain/repositories/authorized-user.repository';
import { AuthorizedUser, Role } from '../../domain/entities/authorized-user.entity';
import { Email } from '../../domain/value-objects/email.vo';

export interface CreateAuthorizedUserRequest {
	email: string;
	role: Role;
}

@Injectable()
export class CreateAuthorizedUserUseCase {
	// Neptun code format: 6 alphanumeric characters @tr.pte.hu
	private readonly neptunEmailRegex = /^[A-Za-z0-9]{6}@tr\.pte\.hu$/i;

	constructor(
		@Inject('AuthorizedUserRepository')
		private readonly authorizedUserRepository: AuthorizedUserRepository
	) {}

	private isValidNeptunEmail(emailAddress: string): boolean {
		return this.neptunEmailRegex.test(emailAddress);
	}

	async execute(request: CreateAuthorizedUserRequest): Promise<AuthorizedUser> {
		const email = new Email(request.email);

		// Validate email follows Neptun format (XXXXXX@tr.pte.hu)
		if (!this.isValidNeptunEmail(request.email)) {
			throw new Error(
				'Invalid email format. Must follow Neptun format: [6 alphanumeric characters]@tr.pte.hu (e.g., FBN7YM@tr.pte.hu)'
			);
		}

		const existing = await this.authorizedUserRepository.findByEmail(email);
		if (existing) {
			throw new Error('Authorized email already exists');
		}

		const now = new Date();
		const authorizedUser = new AuthorizedUser(
			undefined as any,
			email,
			request.role,
			now,
			now,
			false
		);

		return this.authorizedUserRepository.create(authorizedUser);
	}
}

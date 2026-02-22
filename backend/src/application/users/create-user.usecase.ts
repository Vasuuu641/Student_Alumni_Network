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
	constructor(
		@Inject('AuthorizedUserRepository')
		private readonly authorizedUserRepository: AuthorizedUserRepository
	) {}

	async execute(request: CreateAuthorizedUserRequest): Promise<AuthorizedUser> {
		const email = new Email(request.email);
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

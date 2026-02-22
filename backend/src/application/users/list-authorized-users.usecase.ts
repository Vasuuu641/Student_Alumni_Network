import { Injectable, Inject } from '@nestjs/common';
import type { AuthorizedUserRepository } from '../../domain/repositories/authorized-user.repository';
import { AuthorizedUser } from '../../domain/entities/authorized-user.entity';

@Injectable()
export class ListAuthorizedUsersUseCase {
	constructor(
		@Inject('AuthorizedUserRepository')
		private readonly authorizedUserRepository: AuthorizedUserRepository
	) {}

	async execute(): Promise<AuthorizedUser[]> {
		return this.authorizedUserRepository.findAll();
	}
}

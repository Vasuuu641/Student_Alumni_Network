import { Injectable, Inject } from '@nestjs/common';
import type { AuthorizedUserRepository } from '../../domain/repositories/authorized-user.repository';

@Injectable()
export class DeleteAuthorizedUserUseCase {
	constructor(
		@Inject('AuthorizedUserRepository')
		private readonly authorizedUserRepository: AuthorizedUserRepository
	) {}

	async execute(id: string): Promise<void> {
		const existing = await this.authorizedUserRepository.findById(id);
		if (!existing) {
			throw new Error('Authorized user not found');
		}

		if (existing.isUsed) {
			throw new Error('Cannot delete already used authorized user');
		}

		await this.authorizedUserRepository.delete(id);
	}
}

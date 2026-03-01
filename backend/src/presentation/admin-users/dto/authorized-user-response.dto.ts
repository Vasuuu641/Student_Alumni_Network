import { Expose } from 'class-transformer';

export class AuthorizedUserResponseDto {
	@Expose()
	id: string;

	@Expose()
	email: string;

	@Expose()
	role: string;

	@Expose()
	isUsed: boolean;

	@Expose()
	createdAt: Date;

	@Expose()
	updatedAt: Date;
}

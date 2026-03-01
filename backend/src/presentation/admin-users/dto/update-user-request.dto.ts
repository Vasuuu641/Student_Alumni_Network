import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { Role } from '../../../domain/entities/authorized-user.entity';

export class UpdateUserRequestDto {
	@IsOptional()
	@IsEmail()
	email?: string;

	@IsOptional()
	@IsEnum(Role)
	role?: Role;
}

import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { Role } from '../../../domain/entities/role.enum';

export class UpdateUserRequestDto {
	@IsOptional()
	@IsEmail()
	email?: string;

	@IsOptional()
	@IsEnum(Role)
	role?: Role;
}

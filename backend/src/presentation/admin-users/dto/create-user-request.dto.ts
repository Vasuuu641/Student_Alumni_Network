import { IsEmail, IsEnum } from 'class-validator';
import { Role } from '../../../domain/entities/role.enum';

export class CreateUserRequestDto {
	@IsEmail()
	email!: string;

	@IsEnum(Role)
	role!: Role;
}

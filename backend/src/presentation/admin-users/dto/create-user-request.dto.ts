import { IsEmail, IsEnum } from 'class-validator';
import { Role } from '../../../domain/entities/authorized-user.entity';

export class CreateUserRequestDto {
	@IsEmail()
	email: string;

	@IsEnum(Role)
	role: Role;
}

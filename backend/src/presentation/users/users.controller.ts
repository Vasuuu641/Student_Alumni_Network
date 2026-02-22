import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CreateUserRequestDto } from './dto/create-user-request.dto';
import { CreateAuthorizedUserUseCase } from '../../application/users/create-user.usecase';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { JwtStrategy } from '../../auth/jwt.strategy';
import { Role } from '../../domain/entities/authorized-user.entity';

@Controller('admin/users')
export class UsersController {
	constructor(private readonly createAuthorizedUser: CreateAuthorizedUserUseCase) {}

	@Post('authorized')
	@UseGuards(JwtStrategy, RolesGuard)
	@Roles(Role.ADMIN)
	async createAuthorized(@Body() request: CreateUserRequestDto) {
		const authorizedUser = await this.createAuthorizedUser.execute(request);
		return {
			id: authorizedUser.id,
			email: authorizedUser.email.getValue(),
			role: authorizedUser.role,
			isUsed: authorizedUser.isUsed,
		};
	}
}

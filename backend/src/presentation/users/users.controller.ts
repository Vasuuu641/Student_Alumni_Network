import { Body, Controller, Post, UseGuards, Get, Delete, Put, Param, HttpException, HttpStatus, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateUserRequestDto } from './dto/create-user-request.dto';
import { UpdateUserRequestDto } from './dto/update-user-request.dto';
import { AuthorizedUserResponseDto } from './dto/authorized-user-response.dto';
import { CreateAuthorizedUserUseCase } from '../../application/users/create-user.usecase';
import { ListAuthorizedUsersUseCase } from '../../application/users/list-authorized-users.usecase';
import { DeleteAuthorizedUserUseCase } from '../../application/users/delete-authorized-user.usecase';
import { UpdateAuthorizedUserUseCase } from '../../application/users/update-authorized-user.usecase';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { JwtStrategy } from '../../auth/jwt.strategy';
import { Role } from '../../domain/entities/authorized-user.entity';

@Controller('admin/users')
export class UsersController {
	constructor(
		private readonly createAuthorizedUser: CreateAuthorizedUserUseCase,
		private readonly listAuthorizedUsers: ListAuthorizedUsersUseCase,
		private readonly deleteAuthorizedUser: DeleteAuthorizedUserUseCase,
		private readonly updateAuthorizedUser: UpdateAuthorizedUserUseCase,
	) {}

	@Post('authorized')
	@UseGuards(JwtStrategy, RolesGuard)
	@Roles(Role.ADMIN)
	async createAuthorized(@Body() request: CreateUserRequestDto): Promise<AuthorizedUserResponseDto> {
		try {
			const authorizedUser = await this.createAuthorizedUser.execute(request);
			return {
				id: authorizedUser.id,
				email: authorizedUser.email.getValue(),
				role: authorizedUser.role,
				isUsed: authorizedUser.isUsed,
				createdAt: authorizedUser.createdAt,
				updatedAt: authorizedUser.updatedAt,
			};
		} catch (error: any) {
			if (error.message.includes('already exists')) {
				throw new BadRequestException('Email is already authorized');
			}
			if (error.message.includes('invalid')) {
				throw new BadRequestException(error.message);
			}
			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	@Get('authorized')
	@UseGuards(JwtStrategy, RolesGuard)
	@Roles(Role.ADMIN)
	async listAuthorized(): Promise<AuthorizedUserResponseDto[]> {
		try {
			const users = await this.listAuthorizedUsers.execute();
			return users.map(user => ({
				id: user.id,
				email: user.email.getValue(),
				role: user.role,
				isUsed: user.isUsed,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
			}));
		} catch (error: any) {
			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	@Get('authorized/:id')
	@UseGuards(JwtStrategy, RolesGuard)
	@Roles(Role.ADMIN)
	async getAuthorized(@Param('id') id: string): Promise<AuthorizedUserResponseDto> {
		try {
			// Note: We could add a findById endpoint to the use case for this
			const users = await this.listAuthorizedUsers.execute();
			const user = users.find(u => u.id === id);
			if (!user) {
				throw new NotFoundException('Authorized user not found');
			}
			return {
				id: user.id,
				email: user.email.getValue(),
				role: user.role,
				isUsed: user.isUsed,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
			};
		} catch (error: any) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	@Put('authorized/:id')
	@UseGuards(JwtStrategy, RolesGuard)
	@Roles(Role.ADMIN)
	async updateAuthorized(
		@Param('id') id: string,
		@Body() request: UpdateUserRequestDto,
	): Promise<AuthorizedUserResponseDto> {
		try {
			const updated = await this.updateAuthorizedUser.execute({
				id,
				email: request.email,
				role: request.role,
			});
			return {
				id: updated.id,
				email: updated.email.getValue(),
				role: updated.role,
				isUsed: updated.isUsed,
				createdAt: updated.createdAt,
				updatedAt: updated.updatedAt,
			};
		} catch (error: any) {
			if (error.message.includes('not found')) {
				throw new NotFoundException('Authorized user not found');
			}
			if (error.message.includes('already exists')) {
				throw new BadRequestException('Email is already authorized');
			}
			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	@Delete('authorized/:id')
	@UseGuards(JwtStrategy, RolesGuard)
	@Roles(Role.ADMIN)
	async deleteAuthorized(@Param('id') id: string): Promise<{ message: string }> {
		try {
			await this.deleteAuthorizedUser.execute(id);
			return { message: 'Authorized user deleted successfully' };
		} catch (error: any) {
			if (error.message.includes('not found')) {
				throw new NotFoundException('Authorized user not found');
			}
			if (error.message.includes('already used')) {
				throw new BadRequestException('Cannot delete already used authorized user');
			}
			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}
}

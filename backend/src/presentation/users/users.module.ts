import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { CreateAuthorizedUserUseCase } from '../../application/users/create-user.usecase';
import { PrismaAuthorizedUserRepository } from '../../infrastructure/repositories/prisma-authorized-user.repository';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { RolesGuard } from '../../auth/roles.guard';
import { JwtStrategy } from '../../auth/jwt.strategy';

@Module({
	imports: [PrismaModule],
	controllers: [UsersController],
	providers: [
		CreateAuthorizedUserUseCase,
		RolesGuard,
		JwtStrategy,
		{ provide: 'AuthorizedUserRepository', useClass: PrismaAuthorizedUserRepository },
	],
})
export class UsersModule {}

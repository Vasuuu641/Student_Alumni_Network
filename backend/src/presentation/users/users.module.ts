import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { CreateAuthorizedUserUseCase } from '../../application/users/create-user.usecase';
import { PrismaAuthorizedUserRepository } from '../../infrastructure/repositories/prisma-authorized-user.repository';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
	imports: [PrismaModule, AuthModule],
	controllers: [UsersController],
	providers: [
		CreateAuthorizedUserUseCase,
		{ provide: 'AuthorizedUserRepository', useClass: PrismaAuthorizedUserRepository },
	],
})
export class UsersModule {}

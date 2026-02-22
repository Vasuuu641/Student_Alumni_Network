// application/auth/register-user.usecase.ts

import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { AuthorizedUserRepository } from '../../domain/repositories/authorized-user.repository';
import type { PasswordHasher } from '../../domain/services/password-hasher';
import { Email } from '../../domain/value-objects/email.vo';

export interface RegisterUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('AuthorizedUserRepository')
    private readonly authorizedUserRepository: AuthorizedUserRepository,
    @Inject('PasswordHasher')
    private readonly passwordHasher: PasswordHasher
  ) {}

  async execute(request: RegisterUserRequest): Promise<User> {
    const { email, password, firstName, lastName } = request;

    const emailVO = new Email(email);

    // 1️⃣ Check if user already exists
    const existingUser = await this.userRepository.findByEmail(emailVO);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // 2️⃣ Check authorization
    const authorizedUser = await this.authorizedUserRepository.findByEmail(emailVO);
    if (!authorizedUser) {
      throw new Error('Email not authorized');
    }

    if (authorizedUser.isUsed) {
      throw new Error('Email already used');
    }

    // 3️⃣ Hash password
    const hashedPassword = await this.passwordHasher.hash(password);

    // 4️⃣ Create domain entity
    const user = new User(
      undefined as any, // temporary until repository assigns id properly
      emailVO,
      hashedPassword,
      authorizedUser.role,
      firstName,
      lastName,
    );

    // 5️⃣ Persist
    const createdUser = await this.userRepository.create(user);

    // 6️⃣ Update authorized user
    authorizedUser.markAsUsed();
    await this.authorizedUserRepository.update(authorizedUser);

    return createdUser;
  }
}
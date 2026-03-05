// application/auth/register-user.usecase.ts

import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { AuthorizedUserRepository } from '../../domain/repositories/authorized-user.repository';
import type { StudentRepository } from '../../domain/repositories/student.repository';
import type { AlumniRepository } from '../../domain/repositories/alumni.repository';
import type { ProfessorRepository } from '../../domain/repositories/professor.repository';
import type { PasswordHasher } from '../../domain/services/password-hasher';
import { Email } from '../../domain/value-objects/email.vo';
import { Student } from '../../domain/entities/student.entity';
import { Alumni } from '../../domain/entities/alumni.entity';
import { Professor } from '../../domain/entities/professor.entity';
import { Role } from '../../domain/entities/user.entity';

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
    @Inject('StudentRepository')
    private readonly studentRepository: StudentRepository,
    @Inject('AlumniRepository')
    private readonly alumniRepository: AlumniRepository,
    @Inject('ProfessorRepository')
    private readonly professorRepository: ProfessorRepository,
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

    // 5️⃣ Persist user
    const createdUser = await this.userRepository.create(user);

    // 6️⃣ Create role-specific profile
    try {
      await this.createRoleProfile(createdUser.id, authorizedUser.role);
    } catch (profileError) {
      console.error(`Failed to create ${authorizedUser.role} profile for user ${createdUser.id}:`, profileError);
      throw profileError;
    }

    // 7️⃣ Update authorized user
    authorizedUser.markAsUsed();
    await this.authorizedUserRepository.update(authorizedUser);

    return createdUser;
  }

  private async createRoleProfile(userId: string, role: Role): Promise<void> {
    switch (role) {
      case Role.STUDENT:
        const student = new Student(
          userId,
          '', // major - to be completed during onboarding
          null, // yearOfGraduation - to be set during onboarding
          null, // jobTitle - optional
          [], // interests
          null, // faculty - optional, to be completed during onboarding
          null, // bio - optional
          null, // profilePictureUrl - optional
        );
        await this.studentRepository.create(student);
        break;

      case Role.ALUMNI:
        const alumni = new Alumni(
          userId,
          null, // yearOfGraduation - to be set during onboarding
          null, // major - to be completed during onboarding
          null, // company - optional
          null, // jobTitle - optional
          null, // bio - optional
          [], // interests
          null, // profilePictureUrl
          false, // isAnonymous
          null, // anonymousName
        );
        await this.alumniRepository.create(alumni);
        break;

      case Role.PROFESSOR:
        const professor = new Professor(
          userId,
          '', // faculty - to be completed during onboarding
          '', // jobTitle - to be completed during onboarding
          null, // bio - optional
          [], // interests
        );
        await this.professorRepository.create(professor);
        break;

      case Role.ADMIN:
        // Admin doesn't need a separate profile
        break;
    }
  }
}
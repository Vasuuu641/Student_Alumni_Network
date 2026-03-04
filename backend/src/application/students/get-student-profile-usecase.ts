import { Inject, Injectable } from '@nestjs/common';
import type { StudentRepository } from '../../domain/repositories/student.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import { Student } from '../../domain/entities/student.entity';

export interface GetStudentProfileResult {
  student: Student;
  firstName: string;
  lastName: string;
}

@Injectable()
export class GetStudentProfileUseCase {
  constructor(
    @Inject('StudentRepository')
    private readonly studentRepository: StudentRepository,
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
  ) {}

  async execute(userId: string): Promise<GetStudentProfileResult> {
    const student = await this.studentRepository.findByUserId(userId);
    if (!student) {
      throw new Error('Student profile not found');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      student,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
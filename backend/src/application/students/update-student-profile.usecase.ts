//update student profile use case

import { StudentRepository } from '../../domain/repositories/student.repository';
import { Student } from '../../domain/entities/student.entity';

interface UpdateStudentProfileDTO {
  userId: string;
  major?: string;
  yearOfGraduation?: number;
  interests?: string[];
  faculty?: string;
  bio?: string;
}

export class UpdateStudentProfileUseCase {
  constructor(private studentRepository: StudentRepository) {}

  async execute(dto: UpdateStudentProfileDTO): Promise<Student> {
    // 1️⃣ Fetch existing student profile
    const existingStudent = await this.studentRepository.findByUserId(dto.userId);
    if (!existingStudent) {
      throw new Error('Student profile not found');
    }

    // 2️⃣ Update fields if provided
    const updatedStudent = new Student(
      existingStudent.userId,
      dto.major ?? existingStudent.major,
      dto.yearOfGraduation ?? existingStudent.yearOfGraduation,
      dto.interests ?? existingStudent.interests,
      dto.faculty ?? existingStudent.faculty,
      dto.bio ?? existingStudent.bio,
    );

    // 3️⃣ Save updated profile
    return await this.studentRepository.update(updatedStudent);
  }
}
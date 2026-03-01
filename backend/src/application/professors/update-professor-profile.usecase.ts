//professor profile update use case code goes here
import { ProfessorRepository } from '../../domain/repositories/professor.repository';
import { Professor } from '../../domain/entities/professor.entity';

interface UpdateProfessorProfileDTO {
  userId: string;
  faculty?: string;
  jobTitle?: string;
  bio?: string;
  interests?: string[];
}

export class UpdateProfessorProfileUseCase {
  constructor(private professorRepository: ProfessorRepository) {}

  async execute(dto: UpdateProfessorProfileDTO): Promise<Professor> {
    // 1️⃣ Fetch existing professor profile
    const existingProfessor = await this.professorRepository.findByUserId(dto.userId);
    if (!existingProfessor) {
      throw new Error('Professor profile not found');
    }

    // 2️⃣ Update fields if provided
    const updatedProfessor = new Professor(
      existingProfessor.userId,
      dto.faculty ?? existingProfessor.faculty,
      dto.jobTitle ?? existingProfessor.jobTitle,
      dto.bio ?? existingProfessor.bio,
      dto.interests ?? existingProfessor.interests,
    );

    // 3️⃣ Save updated profile
    return await this.professorRepository.update(updatedProfessor);
  }
}
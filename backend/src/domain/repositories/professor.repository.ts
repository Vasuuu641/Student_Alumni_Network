import { Professor } from '../entities/professor.entity';

export interface ProfessorRepository {
  findByUserId(userId: string): Promise<Professor | null>;
  create(professor: Professor): Promise<Professor>;
  update(professor: Professor): Promise<Professor>;
  delete(userId: string): Promise<void>;
}

import { Student } from '../entities/student.entity';

export interface StudentRepository {
  findByUserId(userId: string): Promise<Student | null>;
  create(student: Student): Promise<Student>;
  update(student: Student): Promise<Student>;
  delete(userId: string): Promise<void>;
}

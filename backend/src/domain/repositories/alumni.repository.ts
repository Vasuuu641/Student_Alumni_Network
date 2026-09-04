import { Alumni } from '../entities/alumni.entity';

export interface AlumniRepository {
  findByUserId(userId: string): Promise<Alumni | null>;
  findAll(): Promise<Alumni[]>;
  create(alumni: Alumni): Promise<Alumni>;
  update(alumni: Alumni): Promise<Alumni>;
  delete(userId: string): Promise<void>;
}

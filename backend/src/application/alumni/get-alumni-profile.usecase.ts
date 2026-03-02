import { Inject, Injectable } from '@nestjs/common';
import type { AlumniRepository } from '../../domain/repositories/alumni.repository';
import { Alumni } from '../../domain/entities/alumni.entity';

@Injectable()
export class GetAlumniProfileUseCase {
  constructor(
    @Inject('AlumniRepository')
    private readonly alumniRepository: AlumniRepository,
  ) {}

  async execute(userId: string): Promise<Alumni> {
    const alumni = await this.alumniRepository.findByUserId(userId);
    if (!alumni) {
      throw new Error('Alumni profile not found');
    }
    return alumni;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { AlumniRepository } from '../../domain/repositories/alumni.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import { Alumni } from '../../domain/entities/alumni.entity';

export interface GetAlumniProfileResult {
  alumni: Alumni;
  firstName: string;
  lastName: string;
}

@Injectable()
export class GetAlumniProfileUseCase {
  constructor(
    @Inject('AlumniRepository')
    private readonly alumniRepository: AlumniRepository,
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
  ) {}

  async execute(userId: string): Promise<GetAlumniProfileResult> {
    const alumni = await this.alumniRepository.findByUserId(userId);
    if (!alumni) {
      throw new Error('Alumni profile not found');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      alumni,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}

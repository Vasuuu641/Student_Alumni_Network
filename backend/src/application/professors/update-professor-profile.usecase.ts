import { Inject, Injectable } from '@nestjs/common';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { FileStorageService } from '../../domain/services/file-storage';
import { FileUploadRequest } from '../../domain/services/file-storage';
import type { ProfessorRepository } from '../../domain/repositories/professor.repository';
import { Professor } from '../../domain/entities/professor.entity';
import { UserInterestProfile } from '../../domain/entities/user-interest.entity';
import type { UserInterestProfileRepository } from '../../domain/repositories/user-interest.repository';

interface UpdateProfessorProfileDTO {
  firstName?: string;
  lastName?: string;
  faculty?: string;
  jobTitle?: string;
  bio?: string;
  interests?: string[];
  profilePictureUrl?: string;
}

export interface UpdateProfessorProfileResult {
  professor: Professor;
  firstName: string;
  lastName: string;
}

@Injectable()
export class UpdateProfessorProfileUseCase {
  constructor(
    @Inject('ProfessorRepository')
    private readonly professorRepository: ProfessorRepository,
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('UserInterestProfileRepository')
    private readonly interestProfileRepository: UserInterestProfileRepository,
    @Inject('FileStorageService')
    private readonly fileStorageService: FileStorageService,
  ) {}

  async execute(
    userId: string,
    request: UpdateProfessorProfileDTO,
    profilePicture?: {
      buffer: Buffer;
      originalName: string;
      mimeType: string;
      size: number;
    },
  ): Promise<UpdateProfessorProfileResult> {
    const professor = await this.professorRepository.findByUserId(userId);
    if (!professor) {
      throw new Error('Professor profile not found');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (request.firstName !== undefined || request.lastName !== undefined) {
      const newFirstName = request.firstName ?? user.firstName;
      const newLastName = request.lastName ?? user.lastName;

      if (!newFirstName.trim() || !newLastName.trim()) {
        throw new Error('First name and last name cannot be empty');
      }

      user.changeName(newFirstName, newLastName);
      await this.userRepository.update(user);
    }

    let profilePictureUrl = professor.profilePictureUrl;

    if (profilePicture) {
      const fileRequest: FileUploadRequest = {
        buffer: profilePicture.buffer,
        originalName: profilePicture.originalName,
        mimeType: profilePicture.mimeType,
        size: profilePicture.size,
      };

      const newFileUploaded = await this.fileStorageService.uploadFile('professor-profiles', userId, fileRequest);
      profilePictureUrl = newFileUploaded;

      const updatedProfessor = new Professor(
        professor.userId,
        request.faculty ?? professor.faculty,
        request.jobTitle ?? professor.jobTitle,
        request.bio ?? professor.bio,
        request.interests ?? professor.interests,
        profilePictureUrl,
      );

      const savedProfessor = await this.professorRepository.update(updatedProfessor);
      await this.syncInterestProfile(savedProfessor);

      if (professor.profilePictureUrl && professor.profilePictureUrl !== newFileUploaded) {
        try {
          await this.fileStorageService.deleteFile(professor.profilePictureUrl);
        } catch (cleanupError: any) {
          console.warn(`Failed to cleanup uploaded file after error: ${cleanupError.message}`);
        }
      }

      return {
        professor: savedProfessor,
        firstName: user.firstName,
        lastName: user.lastName,
      };
    }

    const updatedProfessor = new Professor(
      professor.userId,
      request.faculty ?? professor.faculty,
      request.jobTitle ?? professor.jobTitle,
      request.bio ?? professor.bio,
      request.interests ?? professor.interests,
      profilePictureUrl,
    );

    const savedProfessor = await this.professorRepository.update(updatedProfessor);
    await this.syncInterestProfile(savedProfessor);

    return {
      professor: savedProfessor,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  private async syncInterestProfile(professor: Professor): Promise<void> {
    const academicWeight = 0.8;
    const alumniWeight = 0.2;
    const careerWeight = Math.min(1, 0.55 + (professor.jobTitle ? 0.15 : 0));
    const housingWeight = professor.interests.some((interest) => /housing|rent|apartment/i.test(interest)) ? 0.25 : 0.1;
    const shoppingWeight = professor.interests.some((interest) => /shop|shopping|buy/i.test(interest)) ? 0.25 : 0.1;
    const internshipWeight = professor.interests.some((interest) => /intern/i.test(interest)) ? 0.45 : 0.2;

    await this.interestProfileRepository.upsert(
      new UserInterestProfile(
        professor.userId,
        academicWeight,
        alumniWeight,
        careerWeight,
        housingWeight,
        shoppingWeight,
        internshipWeight,
        new Date(),
        new Date(),
        new Date(),
      ),
    );
  }
}

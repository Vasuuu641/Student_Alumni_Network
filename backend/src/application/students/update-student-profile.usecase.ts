import { Inject, Injectable } from '@nestjs/common';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { FileStorageService } from '../../domain/services/file-storage';
import { FileUploadRequest } from '../../domain/services/file-storage';
import type { StudentRepository } from '../../domain/repositories/student.repository';
import { Student } from '../../domain/entities/student.entity';
import { UserInterestProfile } from '../../domain/entities/user-interest.entity';
import type { UserInterestProfileRepository } from '../../domain/repositories/user-interest.repository';

interface UpdateStudentProfileDTO {
  firstName?: string;
  lastName?: string;
  major?: string;
  yearOfGraduation?: number;
  jobTitle?: string;
  company?: string;
  interests?: string[];
  faculty?: string;
  bio?: string;
  profilePicture?: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    size: number;
  };
}

export interface UpdateStudentProfileResult {
  student: Student;
  firstName: string;
  lastName: string;
}

@Injectable()
export class UpdateStudentProfileUseCase {
  constructor(
    @Inject('StudentRepository')
    private readonly studentRepository: StudentRepository,
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('UserInterestProfileRepository')
    private readonly interestProfileRepository: UserInterestProfileRepository,
    @Inject('FileStorageService')
    private readonly fileStorageService: FileStorageService,
  ) {}

  async execute(
    userId: string,
    request: UpdateStudentProfileDTO,
    profilePicture?: {
      buffer: Buffer;
      originalName: string;
      mimeType: string;
      size: number;
    },
  ): Promise<UpdateStudentProfileResult> {
    const student = await this.studentRepository.findByUserId(userId);
    if (!student) {
      throw new Error('Student profile not found');
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

    let profilePictureUrl = student.profilePictureUrl;

    if (profilePicture) {
      try {
        const fileRequest: FileUploadRequest = {
          buffer: profilePicture.buffer,
          originalName: profilePicture.originalName,
          mimeType: profilePicture.mimeType,
          size: profilePicture.size,
        };

        const newFileUploaded = await this.fileStorageService.uploadFile('student-profiles', userId, fileRequest);
        profilePictureUrl = newFileUploaded;

        const updatedStudent = new Student(
          student.userId,
          request.major ?? student.major,
          request.yearOfGraduation ?? student.yearOfGraduation,
          request.jobTitle ?? student.jobTitle,
          request.company ?? student.company,
          request.interests ?? student.interests,
          request.faculty ?? student.faculty,
          request.bio ?? student.bio,
          profilePictureUrl,
        );

        const savedStudent = await this.studentRepository.update(updatedStudent);
        await this.syncInterestProfile(savedStudent);

        if (student.profilePictureUrl && student.profilePictureUrl !== newFileUploaded) {
          try {
            await this.fileStorageService.deleteFile(student.profilePictureUrl);
          } catch (cleanupError: any) {
            console.warn(`Failed to delete old profile picture: ${cleanupError.message}`);
          }
        }

        return {
          student: savedStudent,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      } catch (error: any) {
        throw new Error(`Failed to update profile picture: ${error.message}`);
      }
    }

    const updatedStudent = new Student(
      student.userId,
      request.major ?? student.major,
      request.yearOfGraduation ?? student.yearOfGraduation,
      request.jobTitle ?? student.jobTitle,
      request.company ?? student.company,
      request.interests ?? student.interests,
      request.faculty ?? student.faculty,
      request.bio ?? student.bio,
      profilePictureUrl,
    );

    const savedStudent = await this.studentRepository.update(updatedStudent);
    await this.syncInterestProfile(savedStudent);

    return {
      student: savedStudent,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  private async syncInterestProfile(student: Student): Promise<void> {
    const academicWeight = Math.min(1, 0.7 + (student.faculty ? 0.1 : 0));
    const alumniWeight = 0.3;
    const careerWeight = Math.min(1, 0.35 + (student.jobTitle || student.company ? 0.2 : 0));
    const housingWeight = student.interests.some((interest) => /housing|rent|apartment/i.test(interest)) ? 0.6 : 0.25;
    const shoppingWeight = student.interests.some((interest) => /shop|shopping|buy/i.test(interest)) ? 0.5 : 0.2;
    const internshipWeight = student.interests.some((interest) => /intern/i.test(interest)) ? 0.7 : 0.35;

    await this.interestProfileRepository.upsert(
      new UserInterestProfile(
        student.userId,
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

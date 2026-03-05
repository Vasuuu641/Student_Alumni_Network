//update student profile use case
import { Inject, Injectable } from '@nestjs/common';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { FileStorageService } from '../../domain/services/file-storage';
import { FileUploadRequest } from '../../domain/services/file-storage';
import type { StudentRepository } from '../../domain/repositories/student.repository';
import { Student } from '../../domain/entities/student.entity';

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
      }
    ): Promise<UpdateStudentProfileResult> {
      //Get existing student profile
      const student = await this.studentRepository.findByUserId(userId);
      if (!student) {
        throw new Error('Student profile not found');
      }

      //Get and update usernames if provided
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

    // Handle profile picture upload with transaction safety
    let profilePictureUrl = student.profilePictureUrl;
    let newFileUploaded: string | null = null;
    
    if (profilePicture) {
      try {
        // Step 1: Upload new picture FIRST
        const fileRequest: FileUploadRequest = {
          buffer: profilePicture.buffer,
          originalName: profilePicture.originalName,
          mimeType: profilePicture.mimeType,
          size: profilePicture.size,
        };
        newFileUploaded = await this.fileStorageService.uploadFile(
          'student-profiles',
          userId,
          fileRequest
        );
        profilePictureUrl = newFileUploaded;

        // Step 2: Update database with new URL
                const updatedStudent = new Student(
                    student.userId,
                    request.major ?? student.major,
                    request.yearOfGraduation ?? student.yearOfGraduation,
                    request.jobTitle ?? student.jobTitle,
                    request.company ?? student.company,
                    request.interests ?? student.interests,
                    request.faculty ?? student.faculty,
                    request.bio ?? student.bio,
                    profilePictureUrl
                    );
        
                    const savedStudent = await this.studentRepository.update(updatedStudent);

        //Only after db updates successfully, delete old picture if a new one was uploaded
        if (newFileUploaded && student.profilePictureUrl) {
          try {
            await this.fileStorageService.deleteFile(student.profilePictureUrl);
          } catch (cleanupError) {
            console.warn(`Failed to cleanup uploaded file after error: ${cleanupError.message}`);
          }
        }

       return {
          student: savedStudent,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      } catch (error) {
        // Rollback: cleanup newly uploaded file if it exists
        if (newFileUploaded) {
          try {
            await this.fileStorageService.deleteFile(newFileUploaded);
          } catch (cleanupError) {
            console.warn(`Failed to cleanup uploaded file after error: ${cleanupError.message}`);
          }
        }
        throw new Error(`Failed to update profile picture: ${error.message}`);
      }
    }

     // No profile picture update - just update other fields
        const updatedStudent = new Student(
              student.userId,
              request.major ?? student.major,
              request.yearOfGraduation ?? student.yearOfGraduation,
              request.jobTitle ?? student.jobTitle,
              request.company ?? student.company,
              request.interests ?? student.interests,
              request.faculty ?? student.faculty,
              request.bio ?? student.bio,
              profilePictureUrl
        );
    
        const savedStudent = await this.studentRepository.update(updatedStudent);
    
        return {
          student: savedStudent,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      }
    }


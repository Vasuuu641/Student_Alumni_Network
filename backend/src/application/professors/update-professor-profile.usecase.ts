//professor profile update use case code goes here
import { Inject, Injectable } from '@nestjs/common';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { FileStorageService } from '../../domain/services/file-storage';
import { FileUploadRequest } from '../../domain/services/file-storage';
import type { ProfessorRepository } from '../../domain/repositories/professor.repository';
import { Professor } from '../../domain/entities/professor.entity';

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
  @Inject('FileStorageService')
  private readonly fileStorageService: FileStorageService,
  ){}

  async execute(
    userId: string,
    request: UpdateProfessorProfileDTO,
    profilePicture?: {
      buffer: Buffer;
      originalName: string;
      mimeType: string;
      size: number;
    }
  ): Promise<UpdateProfessorProfileResult> {
    //Get existing professor profile
    const professor = await this.professorRepository.findByUserId(userId);
    if (!professor) {
      throw new Error('Professor profile not found');
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
    let profilePictureUrl = professor.profilePictureUrl;
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
          'professor-profiles',
          userId,
          fileRequest
        );
        profilePictureUrl = newFileUploaded;

        // Step 2: Update database with new URL
                        const updatedProfessor = new Professor(
                            professor.userId,
                            request.faculty ?? professor.faculty,
                            request.jobTitle ?? professor.jobTitle,
                            request.bio ?? professor.bio,
                            request.interests ?? professor.interests,
                            profilePictureUrl
                        );
                
                        const savedProfessor = await this.professorRepository.update(updatedProfessor);

        //Only after db updates successfully, delete old picture if a new one was uploaded
        if (newFileUploaded && professor.profilePictureUrl) {
          try {
            await this.fileStorageService.deleteFile(professor.profilePictureUrl);
          } catch (cleanupError) {
            console.warn(`Failed to cleanup uploaded file after error: ${cleanupError.message}`);
          }
        }

         return {
          professor: savedProfessor,
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
            const updatedProfessor = new Professor(
                  professor.userId,
                  request.faculty ?? professor.faculty,
                  request.jobTitle ?? professor.jobTitle,
                  request.bio ?? professor.bio,
                  request.interests ?? professor.interests,
                  profilePictureUrl
            );
        
            const savedProfessor = await this.professorRepository.update(updatedProfessor);
        
            return {
              professor: savedProfessor,
              firstName: user.firstName,
              lastName: user.lastName,
            };
          }
        }
      
      
      
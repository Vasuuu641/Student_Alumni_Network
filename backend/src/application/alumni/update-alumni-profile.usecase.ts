//Complete onboarding of alumni profile

import { Inject, Injectable } from '@nestjs/common';
import type { AlumniRepository } from '../../domain/repositories/alumni.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';
import { Alumni } from '../../domain/entities/alumni.entity';
import type { FileStorageService } from '../../domain/services/file-storage';
import { FileUploadRequest } from '../../domain/services/file-storage';

export interface UpdateAlumniProfileRequest {
  firstName?: string;
  lastName?: string;
  yearOfGraduation?: number;
  major?: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  interests?: string[];
  profilePicture?: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    size: number;
  };
  isAnonymous?: boolean;
  anonymousName?: string;
}

export interface UpdateAlumniProfileResult {
  alumni: Alumni;
  firstName: string;
  lastName: string;
}

@Injectable()
export class UpdateAlumniProfileUseCase {
  constructor(
    @Inject('AlumniRepository')
    private readonly alumniRepository: AlumniRepository,
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('FileStorageService')
    private readonly fileStorageService: FileStorageService,
  ) {}

  async execute(
    userId: string,
    request: UpdateAlumniProfileRequest,
    profilePicture?: {
      buffer: Buffer;
      originalName: string;
      mimeType: string;
      size: number;
    }
  ): Promise<UpdateAlumniProfileResult> {
    // Get existing alumni profile
    const alumni = await this.alumniRepository.findByUserId(userId);
    if (!alumni) {
      throw new Error('Alumni profile not found');
    }

    // Get and update user names if provided
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
    let profilePictureUrl = alumni.profilePictureUrl;
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
          'alumni-profiles',
          userId,
          fileRequest
        );
        profilePictureUrl = newFileUploaded;

        // Step 2: Update database with new URL
        const updatedAlumni = new Alumni(
          alumni.userId,
          request.yearOfGraduation ?? alumni.yearOfGraduation,
          request.major !== undefined ? request.major : alumni.major,
          request.company ?? alumni.company,
          request.jobTitle ?? alumni.jobTitle,
          request.bio ?? alumni.bio,
          request.interests ?? alumni.interests,
          profilePictureUrl,
          request.isAnonymous ?? alumni.isAnonymous,
          request.anonymousName ?? alumni.anonymousName,
        );

        const savedAlumni = await this.alumniRepository.update(updatedAlumni);

        // Step 3: Only after successful DB update, delete old file
        if (alumni.profilePictureUrl && alumni.profilePictureUrl !== newFileUploaded) {
          try {
            await this.fileStorageService.deleteFile(alumni.profilePictureUrl);
          } catch (deleteError) {
            // Log warning but don't fail - old file is orphaned but new data is saved
            console.warn(`Failed to delete old profile picture: ${deleteError.message}`);
          }
        }

        return {
          alumni: savedAlumni,
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

    // Validate anonymity
    if (request.isAnonymous && !request.anonymousName) {
      throw new Error('Anonymous name is required when enabling anonymity');
    }

    // No profile picture update - just update other fields
    const updatedAlumni = new Alumni(
      alumni.userId,
      request.yearOfGraduation ?? alumni.yearOfGraduation,
      request.major !== undefined ? request.major : alumni.major,
      request.company ?? alumni.company,
      request.jobTitle ?? alumni.jobTitle,
      request.bio ?? alumni.bio,
      request.interests ?? alumni.interests,
      profilePictureUrl,
      request.isAnonymous ?? alumni.isAnonymous,
      request.anonymousName ?? alumni.anonymousName,
    );

    const savedAlumni = await this.alumniRepository.update(updatedAlumni);

    return {
      alumni: savedAlumni,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}



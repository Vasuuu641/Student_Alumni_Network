//Complete onboarding of alumni profile

import { Inject, Injectable } from '@nestjs/common';
import type { AlumniRepository } from '../../domain/repositories/alumni.repository';
import { Alumni } from '../../domain/entities/alumni.entity';
import type { FileStorageService } from '../../domain/services/file-storage';
import { FileUploadRequest } from '../../domain/services/file-storage';

export interface UpdateAlumniProfileRequest {
  yearOfGraduation?: number;
  major?: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  interests?: string[];
  isAnonymous?: boolean;
  anonymousName?: string;
}

@Injectable()
export class UpdateAlumniProfileUseCase {
  constructor(
    @Inject('AlumniRepository')
    private readonly alumniRepository: AlumniRepository,
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
  ): Promise<Alumni> {
    // Get existing alumni profile
    const alumni = await this.alumniRepository.findByUserId(userId);
    if (!alumni) {
      throw new Error('Alumni profile not found');
    }

    // Handle profile picture upload
    let profilePictureUrl = alumni.profilePictureUrl;
    if (profilePicture) {
      // Delete old picture if it exists
      if (alumni.profilePictureUrl) {
        await this.fileStorageService.deleteFile(alumni.profilePictureUrl);
      }

      // Upload new picture
      const fileRequest: FileUploadRequest = {
        buffer: profilePicture.buffer,
        originalName: profilePicture.originalName,
        mimeType: profilePicture.mimeType,
        size: profilePicture.size,
      };
      profilePictureUrl = await this.fileStorageService.uploadFile(
        'alumni-profiles',
        userId,
        fileRequest
      );
    }

    // Validate anonymity
    if (request.isAnonymous && !request.anonymousName) {
      throw new Error('Anonymous name is required when enabling anonymity');
    }

    // Update profile
    const updatedAlumni = new Alumni(
      alumni.userId,
      request.yearOfGraduation ?? alumni.yearOfGraduation,
      request.major ?? alumni.major,
      request.company ?? alumni.company,
      request.jobTitle ?? alumni.jobTitle,
      request.bio ?? alumni.bio,
      request.interests ?? alumni.interests,
      profilePictureUrl,
      request.isAnonymous ?? alumni.isAnonymous,
      request.anonymousName ?? alumni.anonymousName,
    );

    return this.alumniRepository.update(updatedAlumni);
  }
}



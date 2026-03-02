import {
  Controller,
  Get,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpException,
  HttpStatus,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { GetAlumniProfileUseCase } from '../../application/alumni/get-alumni-profile.usecase';
import { UpdateAlumniProfileUseCase } from '../../application/alumni/update-alumni-profile.usecase';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { JwtStrategy } from '../../auth/jwt.strategy';
import { Role } from '../../domain/entities/user.entity';
import { AlumniProfileResponse } from './dto/alumni-profile-response.dto';
import { UpdateAlumniProfileRequest } from './dto/update-alumni-profile.dto';

@Controller('alumni')
export class AlumniController {
  constructor(
    private readonly getAlumniProfile: GetAlumniProfileUseCase,
    private readonly updateAlumniProfile: UpdateAlumniProfileUseCase,
  ) {}

  @Get('profile')
  @UseGuards(JwtStrategy, RolesGuard)
  @Roles(Role.ALUMNI)
  async getProfile(@Req() request: any): Promise<AlumniProfileResponse> {
    try {
      const userId = request.user.userId;
      const alumni = await this.getAlumniProfile.execute(userId);

      return {
        userId: alumni.userId,
        yearOfGraduation: alumni.yearOfGraduation,
        major: alumni.major,
        company: alumni.company,
        jobTitle: alumni.jobTitle,
        bio: alumni.bio,
        interests: alumni.interests,
        profilePictureUrl: alumni.profilePictureUrl,
        isAnonymous: alumni.isAnonymous,
        anonymousName: alumni.anonymousName,
      };
    } catch (error: any) {
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('profile')
  @UseGuards(JwtStrategy, RolesGuard)
  @Roles(Role.ALUMNI)
  @UseInterceptors(FileInterceptor('profilePicture'))
  async updateProfile(
  @Req() request: any,
  @Body() updateDto: UpdateAlumniProfileRequest,
  @UploadedFile() file?: multer.File,
  ): Promise<AlumniProfileResponse> {
    try {
      const userId = request.user.userId;

      const alumni = await this.updateAlumniProfile.execute(
        userId,
        updateDto,
        file
          ? {
              buffer: file.buffer,
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
            }
          : undefined,
      );

      return {
        userId: alumni.userId,
        yearOfGraduation: alumni.yearOfGraduation,
        major: alumni.major,
        company: alumni.company,
        jobTitle: alumni.jobTitle,
        bio: alumni.bio,
        interests: alumni.interests,
        profilePictureUrl: alumni.profilePictureUrl,
        isAnonymous: alumni.isAnonymous,
        anonymousName: alumni.anonymousName,
      };
    } catch (error: any) {
      if (error.message.includes('Anonymous name is required')) {
        throw new BadRequestException(error.message);
      }
      if (error.message.includes('Invalid file type')) {
        throw new BadRequestException(error.message);
      }
      if (error.message.includes('exceeds')) {
        throw new BadRequestException(error.message);
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

}
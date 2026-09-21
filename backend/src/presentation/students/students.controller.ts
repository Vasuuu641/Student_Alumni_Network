import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { File as MulterFile } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetStudentProfileUseCase } from '../../application/students/get-student-profile-usecase';
import { UpdateStudentProfileUseCase } from '../../application/students/update-student-profile.usecase';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { JwtStrategy } from 'src/auth/jwt.strategy';
import { Role } from 'src/domain/entities/role.enum';
import { StudentProfileResponse } from './dto/student-profile-response.dto';
import { UpdateStudentProfileRequest } from './dto/update-student-profile.dto';

@Controller('students')
export class StudentsController {
  private readonly logger = new Logger(StudentsController.name);

  constructor(
    private readonly getStudentProfile: GetStudentProfileUseCase,
    private readonly updateStudentProfile: UpdateStudentProfileUseCase,
  ) {}

  @Get('profile')
  @UseGuards(JwtStrategy, RolesGuard)
  @Roles(Role.STUDENT)
  async getProfile(@Req() request: any): Promise<StudentProfileResponse> {
    try {
      const userId = request.user.userId;
      const { student, firstName, lastName } = await this.getStudentProfile.execute(userId);
      return {
        userId: student.userId,
        firstName,
        lastName,
        major: student.major,
        yearofGraduation: student.yearOfGraduation,
        jobTitle: student.jobTitle,
        company: student.company,
        faculty: student.faculty,
        bio: student.bio,
        interests: student.interests,
        profilePictureUrl: student.profilePictureUrl,
      };
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      this.logger.error(`getProfile failed: ${error.message}`, error.stack);
      throw new HttpException('Failed to load profile', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('profile')
  @UseGuards(JwtStrategy, RolesGuard)
  @Roles(Role.STUDENT)
  @UseInterceptors(FileInterceptor('profilePicture'))
  async updateProfile(
    @Req() request: any,
    @Body() updateDto: UpdateStudentProfileRequest,
    @UploadedFile() file?: MulterFile,
  ): Promise<StudentProfileResponse> {
    try {
      const userId = request.user.userId;
      const { student, firstName, lastName } = await this.updateStudentProfile.execute(
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
        userId: student.userId,
        firstName,
        lastName,
        major: student.major,
        yearofGraduation: student.yearOfGraduation,
        jobTitle: student.jobTitle,
        company: student.company,
        faculty: student.faculty,
        bio: student.bio,
        interests: student.interests,
        profilePictureUrl: student.profilePictureUrl,
      };
    } catch (error: any) {
      if (
        error.message?.includes('Anonymous name is required') ||
        error.message?.includes('Invalid file type') ||
        error.message?.includes('exceeds') ||
        error.message?.includes('cannot be empty')
      ) {
        throw new BadRequestException(error.message);
      }
      this.logger.error(`updateProfile failed: ${error.message}`, error.stack);
      throw new HttpException('Failed to update profile', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
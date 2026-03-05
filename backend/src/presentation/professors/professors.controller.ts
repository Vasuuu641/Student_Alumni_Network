import {Controller, 
    Get, 
    Put, 
    Body, 
    UseGuards, 
    UseInterceptors, 
    UploadedFile, 
    HttpException,
    HttpStatus,
    Req,
    BadRequestException
    } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { GetProfessorProfileUseCase } from "../../application/professors/get-professor-profile.usecase";
import { UpdateProfessorProfileUseCase } from '../../application/professors/update-professor-profile.usecase';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { JwtStrategy } from 'src/auth/jwt.strategy';
import { Role } from 'src/domain/entities/user.entity';
import {professorProfileResponse} from './dto/professor-profile-response.dto';
import { UpdateProfessorProfileRequest } from './dto/update-professor-profile.dto';

@Controller('professors')
export class ProfessorsController {
    constructor(
        private readonly getProfessorProfile: GetProfessorProfileUseCase,
        private readonly updateProfessorProfile: UpdateProfessorProfileUseCase,
      ) {}
    
      @Get('profile')
      @UseGuards(JwtStrategy, RolesGuard)
      @Roles(Role.PROFESSOR)
      async getProfile(@Req() request: any): Promise<professorProfileResponse> {
        try {
          const userId = request.user.userId;
          const { professor, firstName, lastName } = await this.getProfessorProfile.execute(userId);
    
          return {
            userId: professor.userId,
            firstName,
            lastName,
            faculty: professor.faculty,
            jobTitle: professor.jobTitle,
            bio: professor.bio,
            interests: professor.interests,
            profilePictureUrl: professor.profilePictureUrl,
            
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
          @Roles(Role.PROFESSOR)
          @UseInterceptors(FileInterceptor('profilePicture'))
          async updateProfile(
          @Req() request: any,
          @Body() updateDto: UpdateProfessorProfileRequest,
          @UploadedFile() file?: multer.File,
          ): Promise<professorProfileResponse> {
            try {
              const userId = request.user.userId;
        
              const { professor, firstName, lastName } = await this.updateProfessorProfile.execute(
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
                userId: professor.userId,
                firstName,
                lastName,
                faculty: professor.faculty,
                jobTitle: professor.jobTitle,
                bio: professor.bio,
                interests: professor.interests,
                profilePictureUrl: professor.profilePictureUrl,
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
            if (error.message.includes('cannot be empty')) {
            throw new BadRequestException(error.message);
            }
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
        
}
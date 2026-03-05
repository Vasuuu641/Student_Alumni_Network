import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateStudentProfileRequest {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  major?: string;

  @IsOptional()
  @IsNumber()
  yearOfGraduation?: number;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  faculty?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsArray()
  interests?: string[];
}
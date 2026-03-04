import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateStudentProfileRequest {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsNumber()
  yearOfStudy?: number | null;

  @IsOptional()
  @IsString()
  major?: string | null;

  @IsOptional()
  @IsString()
  bio?: string | null;

  @IsOptional()
  @IsArray()
  interests?: string[];
}
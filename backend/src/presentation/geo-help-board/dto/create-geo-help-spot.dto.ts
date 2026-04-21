import { IsIn, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGeoHelpSpotDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @IsIn(['OFFICIAL_RESOURCE', 'COMMUNITY_PICK'])
  section?: 'OFFICIAL_RESOURCE' | 'COMMUNITY_PICK';

  @IsOptional()
  @IsIn([
    'UNIVERSITY_SERVICE',
    'ACADEMIC_DEPARTMENT',
    'ADMIN_OFFICE',
    'STUDENT_SUPPORT',
    'CAMPUS_FACILITY',
    'RESTAURANT',
    'CAFE',
    'STUDY_SPOT',
    'SOCIAL_HANGOUT',
    'FITNESS_WELLNESS',
    'SHOPPING',
    'OTHER',
  ])
  category?:
    | 'UNIVERSITY_SERVICE'
    | 'ACADEMIC_DEPARTMENT'
    | 'ADMIN_OFFICE'
    | 'STUDENT_SUPPORT'
    | 'CAMPUS_FACILITY'
    | 'RESTAURANT'
    | 'CAFE'
    | 'STUDY_SPOT'
    | 'SOCIAL_HANGOUT'
    | 'FITNESS_WELLNESS'
    | 'SHOPPING'
    | 'OTHER';
}

import { IsIn, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGeoHelpSpotDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

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

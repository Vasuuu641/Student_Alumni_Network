import { Type } from 'class-transformer';
import { IsIn, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListNearbyGeoHelpSpotsQueryDto {
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(50)
  radiusKm!: number;

  @IsOptional()
  @IsString()
  city?: string;

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;
}

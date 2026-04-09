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
  @IsIn(['STUDY_SPACE', 'FOOD', 'TRANSPORT', 'HOUSING', 'HEALTH', 'GYM', 'LIBRARY', 'OTHER'])
  category?: 'STUDY_SPACE' | 'FOOD' | 'TRANSPORT' | 'HOUSING' | 'HEALTH' | 'GYM' | 'LIBRARY' | 'OTHER';
}

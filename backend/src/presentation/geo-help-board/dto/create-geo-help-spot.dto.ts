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
  @IsIn(['STUDY_SPACE', 'FOOD', 'TRANSPORT', 'HOUSING', 'HEALTH', 'GYM', 'LIBRARY', 'OTHER'])
  category?: 'STUDY_SPACE' | 'FOOD' | 'TRANSPORT' | 'HOUSING' | 'HEALTH' | 'GYM' | 'LIBRARY' | 'OTHER';
}

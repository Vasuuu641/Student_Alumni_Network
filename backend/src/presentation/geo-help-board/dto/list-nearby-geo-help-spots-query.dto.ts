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
  @IsIn(['STUDY_SPACE', 'FOOD', 'TRANSPORT', 'HOUSING', 'HEALTH', 'GYM', 'LIBRARY', 'OTHER'])
  category?: 'STUDY_SPACE' | 'FOOD' | 'TRANSPORT' | 'HOUSING' | 'HEALTH' | 'GYM' | 'LIBRARY' | 'OTHER';

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

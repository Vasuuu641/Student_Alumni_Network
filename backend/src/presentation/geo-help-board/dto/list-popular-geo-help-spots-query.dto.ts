import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListPopularGeoHelpSpotsQueryDto {
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
}

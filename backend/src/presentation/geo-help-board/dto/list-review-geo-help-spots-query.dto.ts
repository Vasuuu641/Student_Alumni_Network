import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListReviewGeoHelpSpotsQueryDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsIn(['STUDY_SPACE', 'FOOD', 'TRANSPORT', 'HOUSING', 'HEALTH', 'GYM', 'LIBRARY', 'OTHER'])
  category?: 'STUDY_SPACE' | 'FOOD' | 'TRANSPORT' | 'HOUSING' | 'HEALTH' | 'GYM' | 'LIBRARY' | 'OTHER';

  @IsOptional()
  @IsIn(['PENDING', 'VERIFIED', 'REJECTED'])
  reviewStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

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

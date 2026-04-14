import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsIn(['PUBLIC', 'PRIVATE', 'public', 'private'])
  visibility!: 'PUBLIC' | 'PRIVATE' | 'public' | 'private';

  // ownerId is derived from the authenticated user; clients must not supply it

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topicTags?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxMembers?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  initialMemberIds?: string[];
}

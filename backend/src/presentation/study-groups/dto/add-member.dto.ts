import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddMemberDto {
  @IsString()
  // requesterId is derived from the authenticated user; clients must not supply it

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsOptional()
  @IsIn(['OWNER', 'MODERATOR', 'MEMBER'])
  role?: 'OWNER' | 'MODERATOR' | 'MEMBER';
}

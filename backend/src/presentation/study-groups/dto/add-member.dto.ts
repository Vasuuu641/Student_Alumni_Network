import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  requesterId!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsOptional()
  @IsIn(['OWNER', 'MODERATOR', 'MEMBER'])
  role?: 'OWNER' | 'MODERATOR' | 'MEMBER';
}

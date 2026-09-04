import { IsIn, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsString()
  // requesterId is derived from the authenticated user; clients must not supply it

  @IsIn(['OWNER', 'MODERATOR', 'MEMBER'])
  role!: 'OWNER' | 'MODERATOR' | 'MEMBER';
}

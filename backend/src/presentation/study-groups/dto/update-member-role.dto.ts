import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsString()
  @IsNotEmpty()
  requesterId!: string;

  @IsIn(['OWNER', 'MODERATOR', 'MEMBER'])
  role!: 'OWNER' | 'MODERATOR' | 'MEMBER';
}

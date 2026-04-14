import { IsIn } from 'class-validator';

export class RespondInviteDto {
  @IsIn(['ACCEPT', 'DECLINE'])
  decision!: 'ACCEPT' | 'DECLINE';
}

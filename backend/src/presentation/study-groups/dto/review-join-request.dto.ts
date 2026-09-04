import { IsIn } from 'class-validator';

export class ReviewJoinRequestDto {
  @IsIn(['APPROVE', 'DECLINE'])
  decision!: 'APPROVE' | 'DECLINE';
}

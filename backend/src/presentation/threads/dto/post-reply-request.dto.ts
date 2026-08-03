import { IsString, IsOptional } from 'class-validator';

export class PostReplyRequestDto {
  @IsString()
  @IsOptional()
  content!: string;

  @IsString()
  @IsOptional()
  parentReplyId?: string;
}
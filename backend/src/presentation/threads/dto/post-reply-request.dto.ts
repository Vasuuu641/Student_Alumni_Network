import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class PostReplyRequestDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  parentReplyId?: string;
}
import { IsString, IsNotEmpty } from 'class-validator';

export class EditReplyRequestDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
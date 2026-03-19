import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ThreadPanel } from 'src/domain/entities/thread.entity';

export class CreateThreadRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255, { message: 'Title cannot exceed 255 characters' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ThreadPanel)
  @IsNotEmpty()
  panel: ThreadPanel;
}
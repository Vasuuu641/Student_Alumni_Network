import { IsEnum, IsNotEmpty } from 'class-validator';
import { ThreadStatus } from 'src/domain/entities/thread.entity';

export class UpdateThreadStatusRequestDto {
  @IsEnum(ThreadStatus)
  @IsNotEmpty()
  status: ThreadStatus;
}
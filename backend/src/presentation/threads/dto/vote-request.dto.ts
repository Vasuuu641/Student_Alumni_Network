import { IsEnum, IsNotEmpty } from 'class-validator';
import { VoteType } from 'src/domain/entities/thread.entity';

export class VoteRequestDto {
  @IsEnum(VoteType)
  @IsNotEmpty()
  voteType: VoteType;
}
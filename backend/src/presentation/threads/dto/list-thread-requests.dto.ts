import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ThreadPanel } from 'src/domain/entities/thread.entity';
import type { ThreadSortBy } from 'src/domain/repositories/thread.repository';

export class ListThreadsRequestDto {
  @IsEnum(ThreadPanel)
  panel: ThreadPanel;

  @IsOptional()
  @IsEnum(['newest', 'mostReplies', 'topVoted'])
  sortBy?: ThreadSortBy = 'newest';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  take?: number = 20;
}
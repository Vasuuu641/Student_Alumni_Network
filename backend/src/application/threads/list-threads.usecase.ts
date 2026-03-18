import { Injectable, Inject } from '@nestjs/common';
import type { ThreadRepository, ThreadSortBy } from 'src/domain/repositories/thread.repository';
import { Thread, ThreadPanel } from 'src/domain/entities/thread.entity';
import { ThreadAccessPolicy } from './policies/thread-access-policy';
import { Role } from 'src/domain/entities/authorized-user.entity';

interface ListThreadsInput {
  panel: ThreadPanel;
  skip: number;
  take: number;
  sortBy: ThreadSortBy;
}

interface ListThreadsOutput {
  threads: Thread[];
  total: number;
}

@Injectable()
export class ListThreadsUseCase {
  constructor(
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
  ) {}

  async execute(input: ListThreadsInput, userRole: Role): Promise<ListThreadsOutput> {
    ThreadAccessPolicy.validatePanelAccess(userRole, input.panel);

    return this.threadRepository.listByPanel(input.panel, {
      skip: input.skip,
      take: input.take,
      sortBy: input.sortBy,
    });
  }
}
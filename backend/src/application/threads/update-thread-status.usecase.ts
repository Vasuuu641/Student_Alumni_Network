import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { ThreadRepository } from 'src/domain/repositories/thread.repository';
import { Thread, ThreadStatus } from 'src/domain/entities/thread.entity';
import { Role } from 'src/domain/entities/authorized-user.entity';

@Injectable()
export class UpdateThreadStatusUseCase {
  constructor(
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
  ) {}

  async execute(threadId: string, userId: string, userRole: Role, status: ThreadStatus): Promise<Thread> {
    const thread = await this.threadRepository.findById(threadId);

    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    const isAdmin = userRole === Role.ADMIN;
    const isAuthor = thread.isAuthoredBy(userId);

    // Only admin can pin
    if (status === ThreadStatus.PINNED && !isAdmin) {
      throw new ForbiddenException('Only admins can pin threads');
    }

    // Only author or admin can close
    if (status === ThreadStatus.CLOSED && !isAuthor && !isAdmin) {
      throw new ForbiddenException('Only the thread author or an admin can close a thread');
    }

    // Only admin can reopen
    if (status === ThreadStatus.OPEN && !isAdmin && !isAuthor) {
      throw new ForbiddenException('Only the thread author or an admin can reopen a thread');
    }

    return this.threadRepository.updateStatus(threadId, status);
  }
}
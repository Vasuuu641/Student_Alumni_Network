import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { ThreadRepository } from 'src/domain/repositories/thread.repository';
import type { ThreadAttachmentRepository } from 'src/domain/repositories/threadAttachment.repository';
import { Thread } from 'src/domain/entities/thread.entity';
import { ThreadAttachment } from 'src/domain/entities/threadAttachment.entity';
import { ThreadAccessPolicy } from './policies/thread-access-policy';
import { Role } from 'src/domain/entities/role.enum';
import { NotificationEligibilityService } from 'src/infrastructure/services/notification-eligibility.service';
import { InterestSignalType } from 'src/domain/entities/user-interest.entity';

export interface ThreadWithAttachments extends Thread {
  attachments: ThreadAttachment[];
}

@Injectable()
export class GetThreadUseCase {
  constructor(
    @Inject('ThreadRepository') private readonly threadRepository: ThreadRepository,
    @Inject('ThreadAttachmentRepository') private readonly threadAttachmentRepository: ThreadAttachmentRepository,
    private readonly eligibilityService: NotificationEligibilityService,
  ) {}

  async execute(threadId: string, userRole: Role, userId?: string): Promise<ThreadWithAttachments> {
    const thread = await this.threadRepository.findById(threadId);

    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    ThreadAccessPolicy.validatePanelAccess(userRole, thread.panel);

    await this.threadRepository.incrementViewCount(threadId);

    if (userId) {
      this.eligibilityService
        .captureSignal(userId, InterestSignalType.THREAD_VIEW, 'THREAD', thread.id, thread.panel, 'threads')
        .catch((error) => {
          console.error(`Failed to capture thread view signal: ${error?.message ?? error}`);
        });
    }

    const attachments = await this.threadAttachmentRepository.findByThreadId(threadId);

    return Object.assign(thread, { attachments });
  }
}
import { Inject, Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationType } from 'src/domain/entities/notification.entity';
import type { JobQueue, Job } from '../queue/job.interface';
import { PersonalizedNotificationWorkerService } from '../queue/personalized-notification-worker.service';
import { GeoHelpSpotCategory } from 'src/domain/entities/geo-help-spot.entity';

export interface PersonalizedNotificationFanoutRequest {
  type: NotificationType;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  sourceModule: string;
  actionUrl?: string | null;
  dedupeKeyPrefix?: string;
  metadataJson?: Record<string, unknown> | null;
  deliveryChannels?: NotificationChannel[];
  excludeUserIds?: string[];
  threadTitle?: string;
  threadPanel?: 'ACADEMIC' | 'ALUMNI';
  geoCategory?: GeoHelpSpotCategory;
  limit?: number;
  minScore?: number;
}

export interface FanoutResult {
  jobId: string | null;
  createdCount: number | null; // null when queued — count isn't known until the job runs
}

@Injectable()
export class PersonalizedNotificationFanoutService {
  constructor(
    @Inject('PersonalizedNotificationWorkerService')
    private readonly worker: PersonalizedNotificationWorkerService,
    @Inject('JobQueue') private readonly jobQueue?: JobQueue,
  ) {}

  async notifyRelevantUsers(
    request: PersonalizedNotificationFanoutRequest,
  ): Promise<FanoutResult> {
    if (this.jobQueue) {
      const job: Job = {
        type: 'PERSONALIZED_FANOUT',
        payload: request,
      };

      const jobId = await this.jobQueue.add(job);
      return { jobId, createdCount: null };
    }

    // No queue configured — run the exact same logic synchronously via the
    // worker, so there is one implementation of eligibility/scoring/rate
    // limiting, not two that can drift out of sync.
    const createdCount = await this.worker.process(request);
    return { jobId: null, createdCount };
  }
}
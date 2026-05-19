import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { JobQueue } from './job.interface';
import { PersonalizedNotificationWorkerService } from './personalized-notification-worker.service';

@Injectable()
export class JobProcessorService implements OnModuleInit {
  private readonly logger = new Logger(JobProcessorService.name);

  constructor(
    @Inject('JobQueue') private readonly queue: JobQueue,
    private readonly worker: PersonalizedNotificationWorkerService,
  ) {}

  onModuleInit(): void {
    // subscribe to jobs
    this.queue.onJob(async (job) => {
      try {
        if (job.type === 'PERSONALIZED_FANOUT') {
          const created = await this.worker.process(job.payload);
          this.logger.debug(`Processed job ${job.id} created=${created}`);
        } else {
          this.logger.warn(`Unknown job type ${job.type}`);
        }
      } catch (err) {
        this.logger.error(`Job ${job.id} failed: ${err}`);
      }
    });
  }
}

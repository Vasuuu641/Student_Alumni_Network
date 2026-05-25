import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Job, JobQueue } from './job.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class InProcessJobQueueService implements JobQueue, OnModuleDestroy {
  private readonly emitter = new EventEmitter();
  private closed = false;

  async add(job: Job): Promise<string> {
    if (this.closed) throw new Error('Queue is shutting down');
    const id = job.id ?? randomUUID();
    const queued = { ...job, id };
    // emit asynchronously so caller returns quickly
    setImmediate(() => this.emitter.emit('job', queued));
    return id;
  }

  onJob(handler: (job: Job) => Promise<void>): void {
    this.emitter.on('job', (job: Job) => {
      // fire-and-forget; processor handles errors
      handler(job).catch(() => {});
    });
  }

  onModuleDestroy(): void {
    this.closed = true;
    this.emitter.removeAllListeners();
  }
}

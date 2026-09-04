export type JobType = 'PERSONALIZED_FANOUT' | string;

export interface Job {
  id?: string;
  type: JobType;
  payload: any;
  attempts?: number;
}

export interface JobQueue {
  add(job: Job): Promise<string>;
  onJob(handler: (job: Job) => Promise<void>): void;
}

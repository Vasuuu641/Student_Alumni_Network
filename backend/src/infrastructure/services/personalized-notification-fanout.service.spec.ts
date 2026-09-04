import { PersonalizedNotificationFanoutService } from './personalized-notification-fanout.service';
import { NotificationType } from '../../domain/entities/notification.entity';

describe('PersonalizedNotificationFanoutService', () => {
  let service: PersonalizedNotificationFanoutService;
  let interestRepo: any;
  let aiScoring: any;
  let createNotification: any;
  let jobQueue: any;

  beforeEach(() => {
    const profiles = [{ userId: 'user1' }, { userId: 'user2' }, { userId: 'user3' }];

    interestRepo = { findAll: jest.fn().mockResolvedValue(profiles) };
    aiScoring = {
      scoreNotification: jest.fn().mockImplementation(async (userId: string) => {
        const map: Record<string, any> = {
          user1: { score: 0.9, reason: 'strong-match' },
          user2: { score: 0.4, reason: 'weak-match' },
          user3: { score: 0.6, reason: 'ok-match' },
        };

        return map[userId] ?? { score: 0.0, reason: 'none' };
      }),
    };

    createNotification = { execute: jest.fn().mockResolvedValue(null) };
    jobQueue = { add: jest.fn().mockResolvedValue('job-1'), onJob: jest.fn() };

    service = new PersonalizedNotificationFanoutService(interestRepo, aiScoring, createNotification, jobQueue);
  });

  it('creates notifications for top recipients obeying limit and minScore', async () => {
    const jobId = await service.notifyRelevantUsers({
      type: NotificationType.THREAD_ACTIVITY,
      title: 'New thread',
      body: 'Body',
      entityType: 'THREAD',
      entityId: 't1',
      sourceModule: 'THREADS',
      limit: 2,
      minScore: 0.45,
    });
    expect(jobId).toBe('job-1');
    expect(jobQueue.add).toHaveBeenCalledTimes(1);
    expect(createNotification.execute).toHaveBeenCalledTimes(0);
  });

  it('respects excludeUserIds', async () => {
    const jobId = await service.notifyRelevantUsers({
      type: NotificationType.THREAD_ACTIVITY,
      title: 'New thread',
      body: 'Body',
      entityType: 'THREAD',
      entityId: 't2',
      sourceModule: 'THREADS',
      excludeUserIds: ['user1'],
      minScore: 0.45,
    });
    expect(jobId).toBe('job-1');
    expect(jobQueue.add).toHaveBeenCalledTimes(1);
    expect(createNotification.execute).toHaveBeenCalledTimes(0);
  });
});

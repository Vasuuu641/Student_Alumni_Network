import { PersonalizedNotificationWorkerService } from './personalized-notification-worker.service';
import { NotificationType } from '../../domain/entities/notification.entity';

describe('PersonalizedNotificationWorkerService rate limiting', () => {
  let service: PersonalizedNotificationWorkerService;
  let interestRepo: any;
  let aiScoring: any;
  let createNotification: any;

  beforeEach(() => {
    interestRepo = { findAll: jest.fn().mockResolvedValue([{ userId: 'user1' }]) };
    aiScoring = {
      scoreNotification: jest.fn().mockResolvedValue({ score: 0.99, reason: 'match' }),
    };
    createNotification = { execute: jest.fn().mockResolvedValue(null) };
    service = new PersonalizedNotificationWorkerService(interestRepo, aiScoring, createNotification);
  });

  it('skips creating a notification when the user already hit the per-minute limit', async () => {
    const now = Date.now();
    const perUserTimestamps = new Map<string, number[]>([['user1', [now - 1, now - 2, now - 3, now - 4, now - 5]]]);
    (service as any).perUserTimestamps = perUserTimestamps;

    const created = await service.process({
      type: NotificationType.THREAD_ACTIVITY,
      title: 'New thread',
      body: 'Body',
      entityType: 'THREAD',
      entityId: 'thread-1',
      sourceModule: 'THREADS',
      limit: 5,
      minScore: 0.45,
    });

    expect(created).toBe(0);
    expect(createNotification.execute).not.toHaveBeenCalled();
  });

  it('allows creating a notification once old timestamps fall outside the window', async () => {
    const now = Date.now();
    const perUserTimestamps = new Map<string, number[]>([['user1', [now - 61_000, now - 62_000, now - 63_000]]]);
    (service as any).perUserTimestamps = perUserTimestamps;

    const created = await service.process({
      type: NotificationType.THREAD_ACTIVITY,
      title: 'New thread',
      body: 'Body',
      entityType: 'THREAD',
      entityId: 'thread-2',
      sourceModule: 'THREADS',
      limit: 5,
      minScore: 0.45,
    });

    expect(created).toBe(1);
    expect(createNotification.execute).toHaveBeenCalledTimes(1);
    expect(createNotification.execute.mock.calls[0][0].userId).toBe('user1');
  });
});

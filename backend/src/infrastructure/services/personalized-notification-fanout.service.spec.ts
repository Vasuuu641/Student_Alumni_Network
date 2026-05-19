import { PersonalizedNotificationFanoutService } from './personalized-notification-fanout.service';
import { NotificationType } from '../../domain/entities/notification.entity';

describe('PersonalizedNotificationFanoutService', () => {
  let service: PersonalizedNotificationFanoutService;
  let interestRepo: any;
  let aiScoring: any;
  let createNotification: any;

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

    service = new PersonalizedNotificationFanoutService(interestRepo, aiScoring, createNotification);
  });

  it('creates notifications for top recipients obeying limit and minScore', async () => {
    const count = await service.notifyRelevantUsers({
      type: NotificationType.THREAD_ACTIVITY,
      title: 'New thread',
      body: 'Body',
      entityType: 'THREAD',
      entityId: 't1',
      sourceModule: 'THREADS',
      limit: 2,
      minScore: 0.45,
    });

    expect(count).toBe(2);
    expect(createNotification.execute).toHaveBeenCalledTimes(2);
    const calledUserIds = createNotification.execute.mock.calls.map((c: any) => c[0].userId);
    expect(calledUserIds).toEqual(['user1', 'user3']);
    const meta = createNotification.execute.mock.calls[0][0].metadataJson;
    expect(meta.aiScore).toBeDefined();
  });

  it('respects excludeUserIds', async () => {
    const count = await service.notifyRelevantUsers({
      type: NotificationType.THREAD_ACTIVITY,
      title: 'New thread',
      body: 'Body',
      entityType: 'THREAD',
      entityId: 't2',
      sourceModule: 'THREADS',
      excludeUserIds: ['user1'],
      minScore: 0.45,
    });

    expect(count).toBe(1);
    expect(createNotification.execute).toHaveBeenCalledTimes(1);
    expect(createNotification.execute.mock.calls[0][0].userId).toBe('user3');
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotificationEligibilityService } from './notification-eligibility.service';
import { NotificationAIScoringService } from './notification-ai-scoring.service';
import { UserInterestProfile, UserInterestSignal, InterestSignalType } from 'src/domain/entities/user-interest.entity';
import type {
  UserInterestProfileRepository,
  UserInterestSignalRepository,
} from 'src/domain/repositories/user-interest.repository';

describe('NotificationEligibilityService', () => {
  let service: NotificationEligibilityService;

  const profile = new UserInterestProfile(
    'user-1',
    0.7,
    0.9,
    0.8,
    0.2,
    0.1,
    0.6,
    new Date('2026-05-04T10:00:00.000Z'),
    new Date('2026-05-04T10:00:00.000Z'),
    new Date('2026-05-04T10:00:00.000Z'),
  );

  const userInterestProfileRepository: any = {
    findByUserId: jest.fn(async () => profile),
    upsert: jest.fn(async () => profile),
    incrementWeight: jest.fn(async () => undefined),
  };

  const userInterestSignalRepository: any = {
    create: jest.fn(async (signal: UserInterestSignal) => signal),
    findRecentByUserId: jest.fn(async () => []),
    findByEntityAndUser: jest.fn(async () => [
      new UserInterestSignal(
        'signal-1',
        'user-1',
        InterestSignalType.THREAD_VIEW,
        'THREAD',
        'thread-1',
        'ALUMNI',
        'threads',
        1,
        null,
        new Date('2026-05-04T09:50:00.000Z'),
      ),
      new UserInterestSignal(
        'signal-2',
        'user-1',
        InterestSignalType.THREAD_OPEN,
        'THREAD',
        'thread-1',
        'ALUMNI',
        'threads',
        1,
        null,
        new Date('2026-05-04T09:52:00.000Z'),
      ),
      new UserInterestSignal(
        'signal-3',
        'user-1',
        InterestSignalType.THREAD_REPLY,
        'THREAD',
        'thread-1',
        'ALUMNI',
        'threads',
        1,
        null,
        new Date('2026-05-04T09:55:00.000Z'),
      ),
    ]),
  };

  const aiScoringService: any = {
    scoreNotification: jest.fn(async () => ({
      score: 0.82,
      reason: 'semantic match',
    })),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEligibilityService,
        {
          provide: 'UserInterestProfileRepository',
          useValue: userInterestProfileRepository,
        },
        {
          provide: 'UserInterestSignalRepository',
          useValue: userInterestSignalRepository,
        },
        {
          provide: NotificationAIScoringService,
          useValue: aiScoringService,
        },
      ],
    }).compile();

    service = moduleFixture.get(NotificationEligibilityService);
  });

  it('passes eligibility when AI and behavior signals are strong', async () => {
    const result = await service.checkEligibility(
      'user-1',
      'thread-1',
      'New reply on Career thread',
      'A discussion you started has a new reply.',
      'Career thread',
      'ALUMNI',
    );

    expect(result.passed).toBe(true);
    expect(result.finalScore).toBeGreaterThanOrEqual(0.6);
    expect(aiScoringService.scoreNotification).toHaveBeenCalled();
    expect(userInterestSignalRepository.findByEntityAndUser).toHaveBeenCalledWith(
      'user-1',
      'THREAD',
      'thread-1',
    );
  });

  it('captures a user interest signal', async () => {
    const created = await service.captureSignal(
      'user-1',
      InterestSignalType.THREAD_REPLY,
      'THREAD',
      'thread-1',
      'ALUMNI',
      'threads',
    );

    expect(created.userId).toBe('user-1');
    expect(created.type).toBe(InterestSignalType.THREAD_REPLY);
    expect(userInterestSignalRepository.create).toHaveBeenCalled();
  });
});
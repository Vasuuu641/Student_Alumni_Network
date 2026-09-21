// test/notifications/notifications.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { NotificationEligibilityService } from '../../src/infrastructure/services/notification-eligibility.service';
import { NotificationAIScoringService } from '../../src/infrastructure/services/notification-ai-scoring.service';
import { UserInterestProfile } from '../../src/domain/entities/user-interest.entity';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('NotificationEligibilityService', () => {
  let service: NotificationEligibilityService;

  // Add generic return types to jest.fn() to prevent TS inferring them as 'never'
  const profileRepo = {
    findByUserId: jest.fn<() => Promise<UserInterestProfile | null>>(),
    upsert: jest.fn<() => Promise<any>>(),
  };

  const signalRepo = {
    findByEntityAndUser: jest.fn<() => Promise<any[]>>(),
    create: jest.fn<() => Promise<any>>(),
  };

  const muteRepo = {
    isEntityMuted: jest.fn<() => Promise<boolean>>(),
    isCategoryMuted: jest.fn<() => Promise<boolean>>(),
  };

  const aiScoring = {
    scoreNotification: jest.fn<() => Promise<{ score: number; reason: string }>>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        NotificationEligibilityService,
        { provide: 'UserInterestProfileRepository', useValue: profileRepo },
        { provide: 'UserInterestSignalRepository', useValue: signalRepo },
        { provide: 'NotificationMuteRepository', useValue: muteRepo },
        { provide: NotificationAIScoringService, useValue: aiScoring },
      ],
    }).compile();

    service = module.get(NotificationEligibilityService);
  });

  it('rejects immediately if the entity is muted, without calling AI', async () => {
    muteRepo.isEntityMuted.mockResolvedValue(true);

    const result = await service.checkEligibility(
      'user-1', 'THREAD', 'thread-1', 'title', 'body', 'threads',
    );

    expect(result.passed).toBe(false);
    expect(result.reason).toBe('Source is muted');
    expect(aiScoring.scoreNotification).not.toHaveBeenCalled();
  });

  it('passes when AI score + signal score clear the 0.6 threshold', async () => {
    muteRepo.isEntityMuted.mockResolvedValue(false);
    muteRepo.isCategoryMuted.mockResolvedValue(false);
    signalRepo.findByEntityAndUser.mockResolvedValue([]);
    profileRepo.findByUserId.mockResolvedValue(
      new UserInterestProfile('user-1', 0.9, 0.5, 0.3, 0.3, 0.2, 0.3, 0.4, 0.4, 0.4, 0.3, new Date(), new Date(), new Date()),
    );
    aiScoring.scoreNotification.mockResolvedValue({ score: 0.95, reason: 'High similarity' });

    const result = await service.checkEligibility(
      'user-1', 'THREAD', 'thread-1', 'title', 'body', 'threads', undefined, undefined,
    );

    // rawScore with zero signals = 0.3 flat floor; finalScore = (0.95 + 0.3) / 2 = 0.625
    expect(result.finalScore).toBeCloseTo(0.625, 3);
    expect(result.passed).toBe(true);
  });

  it('rejects when AI score is low even with a decent profile weight', async () => {
    muteRepo.isEntityMuted.mockResolvedValue(false);
    muteRepo.isCategoryMuted.mockResolvedValue(false);
    signalRepo.findByEntityAndUser.mockResolvedValue([]);
    profileRepo.findByUserId.mockResolvedValue(
      new UserInterestProfile('user-1', 0.9, 0.5, 0.3, 0.3, 0.2, 0.3, 0.4, 0.4, 0.4, 0.3, new Date(), new Date(), new Date()),
    );
    aiScoring.scoreNotification.mockResolvedValue({ score: 0.1, reason: 'Low similarity' });

    const result = await service.checkEligibility(
      'user-1', 'THREAD', 'thread-1', 'title', 'body', 'threads',
    );

    expect(result.passed).toBe(false);
  });
});
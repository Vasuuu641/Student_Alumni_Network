import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { MentorClusteringService } from './mentor-clustering.service';
import { ThreadPanel } from 'src/domain/entities/thread.entity';
import type { AlumniRepository } from 'src/domain/repositories/alumni.repository';
import { Alumni } from 'src/domain/entities/alumni.entity';

describe('MentorClusteringService', () => {
  let service: MentorClusteringService;
  const originalCohereKey = process.env.COHERE_API_KEY;

  const alumniRepository: AlumniRepository = {
    findByUserId: async () => null,
    findAll: async () => [
      new Alumni(
        'alumni-1',
        2020,
        'Computer Science',
        'TechCorp',
        'Software Engineer',
        'I mentor students on backend systems and distributed systems.',
        ['backend', 'distributed systems', 'mentorship'],
        null,
        false,
        null,
      ),
      new Alumni(
        'alumni-2',
        2019,
        'Business',
        'SalesCorp',
        'Account Manager',
        'I focus on sales and customer success.',
        ['sales', 'customer success'],
        null,
        false,
        null,
      ),
      new Alumni(
        'alumni-3',
        2018,
        'Computer Science',
        'DevOps Inc',
        'Platform Engineer',
        'I help with cloud infrastructure and career advice for engineers.',
        ['cloud', 'devops', 'career'],
        null,
        false,
        null,
      ),
    ],
    create: async (alumni) => alumni,
    update: async (alumni) => alumni,
    delete: async () => undefined,
  };

  beforeEach(() => {
    delete process.env.COHERE_API_KEY;
    service = new MentorClusteringService(alumniRepository);
  });

  afterEach(() => {
    process.env.COHERE_API_KEY = originalCohereKey;
  });

  it('returns alumni mentors that match the thread topic', async () => {
    const matches = await service.findRelevantMentors({
      title: 'Need help with backend APIs and distributed systems',
      description: 'Looking for advice on scaling a backend service and message handling.',
      panel: ThreadPanel.ALUMNI,
      limit: 2,
      excludeUserIds: ['student-1'],
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].userId).toBe('alumni-1');
    expect(matches[0].score).toBeGreaterThanOrEqual(matches[matches.length - 1].score);
  });

  it('does not match mentors for non-alumni panels', async () => {
    const matches = await service.findRelevantMentors({
      title: 'Academic thread',
      description: 'General academic question',
      panel: ThreadPanel.ACADEMIC,
      limit: 3,
    });

    expect(matches).toEqual([]);
  });
});

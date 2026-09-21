// test/e2e/notifications-gateway.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import { NotificationsGateway } from '../../src/infrastructure/websocket/notifications.gateway';
import { afterAll, beforeAll, describe, expect, it, jest, afterEach} from '@jest/globals';

describe('NotificationsGateway (e2e)', () => {
  let app: INestApplication;
  let gateway: NotificationsGateway;
  let client: Socket;
  const PORT = 3999;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        {
          provide: 'TokenService',
          useValue: {
            verifyAccessToken: async (token: string) => {
              if (token !== 'valid-token') throw new Error('invalid');
              return { userId: 'user-1', role: 'STUDENT' };
            },
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    gateway = moduleFixture.get(NotificationsGateway);
    await app.listen(PORT);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    client?.disconnect();
  });

  it('rejects a connection with an invalid token', (done) => {
    client = io(`http://localhost:${PORT}/notifications`, { auth: { token: 'bad-token' } });
    client.on('error', (payload) => {
      expect(payload.message).toContain('Unauthorized');
      done();
    });
  });

  it('delivers notifications:new to the correct user room', (done) => {
    client = io(`http://localhost:${PORT}/notifications`, { auth: { token: 'valid-token' } });

    client.on('connect', () => {
      // give the server a beat to finish socket.join() before pushing
      setTimeout(() => {
        gateway.pushNewNotification('user-1', {
          id: 'notif-1',
          userId: 'user-1',
          type: 'THREAD_REPLY',
          title: 'Test notification',
          body: 'Body text',
          entityType: 'THREAD',
          entityId: 'thread-1',
          sourceModule: 'threads',
          score: 0.8,
          isRead: false,
          readAt: null,
          dismissedAt: null,
          actionUrl: null,
          dedupeKey: null,
          metadataJson: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }, 50);
    });

    client.on('notifications:new', (payload) => {
      expect(payload.id).toBe('notif-1');
      expect(payload.title).toBe('Test notification');
      done();
    });
  });

  it('does not deliver to a different user\'s socket', (done) => {
    client = io(`http://localhost:${PORT}/notifications`, { auth: { token: 'valid-token' } });
    const received = jest.fn();
    client.on('notifications:new', received);

    client.on('connect', () => {
      setTimeout(() => {
        gateway.pushNewNotification('some-other-user', { id: 'notif-2' } as any);
        setTimeout(() => {
          expect(received).not.toHaveBeenCalled();
          done();
        }, 100);
      }, 50);
    });
  });
});
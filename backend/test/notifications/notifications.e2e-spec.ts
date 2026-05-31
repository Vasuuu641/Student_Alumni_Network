import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { NotificationsController } from '../../src/presentation/notifications/notifications.controller';
import { JwtStrategy } from '../../src/auth/jwt.strategy';
import { RolesGuard } from '../../src/auth/roles.guard';
import { ListNotificationsUseCase } from '../../src/application/notifications/list-notifications.usecase';
import { GetUnreadNotificationCountUseCase } from '../../src/application/notifications/get-unread-notification-count.usecase';
import { MarkNotificationReadUseCase } from '../../src/application/notifications/mark-notification-read.usecase';
import { MarkAllNotificationsReadUseCase } from '../../src/application/notifications/mark-all-notifications-read.usecase';
import { DismissNotificationUseCase } from '../../src/application/notifications/dismiss-notification.usecase';
import { GetNotificationPreferencesUseCase } from '../../src/application/notifications/get-notification-preferences.usecase';
import { UpdateNotificationPreferencesUseCase } from '../../src/application/notifications/update-notification-preferences.usecase';

describe('NotificationsController (e2e)', () => {
  let app: INestApplication<App>;

  const mockNotification = {
    id: 'notif-1',
    userId: 'user-1',
    type: 'THREAD_REPLY',
    title: 'New reply on Career thread',
    body: 'A discussion you started has a new reply.',
    entityType: 'THREAD',
    entityId: 'thread-1',
    sourceModule: 'threads',
    score: 0.84,
    isRead: false,
    readAt: null,
    dismissedAt: null,
    actionUrl: '/threads/thread-1',
    dedupeKey: 'thread-reply:thread-1:reply-1',
    metadataJson: { aiScore: 0.9 },
    createdAt: new Date('2026-05-04T10:00:00.000Z'),
    updatedAt: new Date('2026-05-04T10:00:00.000Z'),
  };

  const listNotificationsUseCase: any = {
    execute: jest.fn() as jest.Mock,
  };
  listNotificationsUseCase.execute.mockResolvedValue({
    notifications: [mockNotification],
    total: 1,
  });

  const unreadCountUseCase: any = {
    execute: jest.fn() as jest.Mock,
  };
  unreadCountUseCase.execute.mockResolvedValue(1);

  const markReadUseCase: any = {
    execute: jest.fn() as jest.Mock,
  };
  markReadUseCase.execute.mockResolvedValue({
    ...mockNotification,
    isRead: true,
    readAt: new Date('2026-05-04T10:05:00.000Z'),
  });

  const markAllReadUseCase: any = {
    execute: jest.fn() as jest.Mock,
  };
  markAllReadUseCase.execute.mockResolvedValue({ updatedCount: 1 });

  const dismissUseCase: any = {
    execute: jest.fn() as jest.Mock,
  };
  dismissUseCase.execute.mockResolvedValue({
    ...mockNotification,
    dismissedAt: new Date('2026-05-04T10:06:00.000Z'),
  });

  const preferences = {
    userId: 'user-1',
    inAppEnabled: true,
    emailEnabled: false,
    pushEnabled: false,
    createdAt: new Date('2026-05-04T10:00:00.000Z'),
    updatedAt: new Date('2026-05-04T10:00:00.000Z'),
  };

  const getPreferencesUseCase: any = {
    execute: jest.fn() as jest.Mock,
  };
  getPreferencesUseCase.execute.mockResolvedValue(preferences);

  const updatePreferencesUseCase: any = {
    execute: jest.fn() as jest.Mock,
  };
  updatePreferencesUseCase.execute.mockResolvedValue({
    ...preferences,
    emailEnabled: true,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: ListNotificationsUseCase, useValue: listNotificationsUseCase },
        { provide: GetUnreadNotificationCountUseCase, useValue: unreadCountUseCase },
        { provide: MarkNotificationReadUseCase, useValue: markReadUseCase },
        { provide: MarkAllNotificationsReadUseCase, useValue: markAllReadUseCase },
        { provide: DismissNotificationUseCase, useValue: dismissUseCase },
        { provide: GetNotificationPreferencesUseCase, useValue: getPreferencesUseCase },
        { provide: UpdateNotificationPreferencesUseCase, useValue: updatePreferencesUseCase },
        {
          provide: 'TokenService',
          useValue: {
            verifyAccessToken: async () => ({ userId: 'user-1', role: 'STUDENT' }),
          },
        },
        {
          provide: JwtStrategy,
          useClass: JwtStrategy,
        },
        {
          provide: Reflector,
          useValue: new Reflector(),
        },
        {
          provide: RolesGuard,
          useClass: RolesGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const authHeader = { Authorization: 'Bearer test-token' };

  it('GET /notifications returns the inbox list', async () => {
    const response = await request(app.getHttpServer())
      .get('/notifications')
      .set(authHeader)
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.notifications).toHaveLength(1);
    expect(listNotificationsUseCase.execute).toHaveBeenCalledWith('user-1', {
      skip: 0,
      take: 20,
      unreadOnly: false,
    });
  });

  it('GET /notifications/unread-count returns the unread badge count', async () => {
    const response = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set(authHeader)
      .expect(200);

    expect(response.body.unreadCount).toBe(1);
  });

  it('GET /notifications/preferences returns user notification preferences', async () => {
    const response = await request(app.getHttpServer())
      .get('/notifications/preferences')
      .set(authHeader)
      .expect(200);

    expect(response.body.preferences.userId).toBe('user-1');
    expect(response.body.preferences.inAppEnabled).toBe(true);
  });

  it('PATCH /notifications/preferences updates preferences', async () => {
    const response = await request(app.getHttpServer())
      .patch('/notifications/preferences')
      .set(authHeader)
      .send({ emailEnabled: true })
      .expect(200);

    expect(response.body.preferences.emailEnabled).toBe(true);
    expect(updatePreferencesUseCase.execute).toHaveBeenCalledWith('user-1', {
      emailEnabled: true,
    });
  });

  it('PATCH /notifications/:id/read marks a notification read', async () => {
    const response = await request(app.getHttpServer())
      .patch('/notifications/notif-1/read')
      .set(authHeader)
      .expect(200);

    expect(response.body.notification.isRead).toBe(true);
    expect(markReadUseCase.execute).toHaveBeenCalledWith('notif-1', 'user-1');
  });

  it('PATCH /notifications/read-all marks all notifications read', async () => {
    const response = await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set(authHeader)
      .expect(200);

    expect(response.body.updatedCount).toBe(1);
  });

  it('PATCH /notifications/:id/dismiss dismisses a notification', async () => {
    const response = await request(app.getHttpServer())
      .patch('/notifications/notif-1/dismiss')
      .set(authHeader)
      .expect(200);

    expect(response.body.notification.dismissedAt).toBeDefined();
    expect(dismissUseCase.execute).toHaveBeenCalledWith('notif-1', 'user-1');
  });
});
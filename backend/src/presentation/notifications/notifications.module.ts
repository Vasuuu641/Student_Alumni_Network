import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { CreateNotificationUseCase } from '../../application/notifications/create-notification.usecase';
import { ListNotificationsUseCase } from '../../application/notifications/list-notifications.usecase';
import { GetUnreadNotificationCountUseCase } from '../../application/notifications/get-unread-notification-count.usecase';
import { MarkNotificationReadUseCase } from '../../application/notifications/mark-notification-read.usecase';
import { MarkAllNotificationsReadUseCase } from '../../application/notifications/mark-all-notifications-read.usecase';
import { DismissNotificationUseCase } from '../../application/notifications/dismiss-notification.usecase';
import { GetNotificationPreferencesUseCase } from '../../application/notifications/get-notification-preferences.usecase';
import { UpdateNotificationPreferencesUseCase } from '../../application/notifications/update-notification-preferences.usecase';
import { PrismaNotificationRepository } from '../../infrastructure/repositories/prisma-notification.repository';
import { PrismaNotificationPreferenceRepository } from '../../infrastructure/repositories/prisma-notification-preference.repository';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotificationsController],
  providers: [
    CreateNotificationUseCase,
    ListNotificationsUseCase,
    GetUnreadNotificationCountUseCase,
    MarkNotificationReadUseCase,
    MarkAllNotificationsReadUseCase,
    DismissNotificationUseCase,
    GetNotificationPreferencesUseCase,
    UpdateNotificationPreferencesUseCase,
    PrismaNotificationRepository,
    PrismaNotificationPreferenceRepository,
    {
      provide: 'NotificationRepository',
      useClass: PrismaNotificationRepository,
    },
    {
      provide: 'NotificationPreferenceRepository',
      useClass: PrismaNotificationPreferenceRepository,
    },
  ],
  exports: [CreateNotificationUseCase],
})
export class NotificationsModule {}
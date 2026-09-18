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
import { MuteNotificationSourceUseCase } from '../../application/notifications/mute-notification-source.usecase';
import { MuteNotificationCategoryUseCase } from '../../application/notifications/mute-notification-category.usecase';
import { UnmuteNotificationUseCase } from '../../application/notifications/unmute-notification.usecase';
import { ListNotificationMutesUseCase } from '../../application/notifications/list-notification-mute.usecase';
import { PrismaNotificationRepository } from '../../infrastructure/repositories/prisma-notification.repository';
import { PrismaNotificationPreferenceRepository } from '../../infrastructure/repositories/prisma-notification-preference.repository';
import { PrismaNotificationMuteRepository } from '../../infrastructure/repositories/prisma-notification-mute.repository';
import { PrismaAlumniRepository } from '../../infrastructure/repositories/prisma-alumni.repository';
import {
  PrismaUserInterestProfileRepository,
  PrismaUserInterestSignalRepository,
} from '../../infrastructure/repositories/prisma-user-interest.repository';
import { NotificationAIScoringService } from '../../infrastructure/services/notification-ai-scoring.service';
import { NotificationEligibilityService } from '../../infrastructure/services/notification-eligibility.service';
import { MentorClusteringService } from '../../infrastructure/ai/cohere/mentor-clustering.service';
import { PersonalizedNotificationFanoutService } from '../../infrastructure/services/personalized-notification-fanout.service';
import { InProcessJobQueueService } from '../../infrastructure/queue/in-process-job-queue.service';
import { PersonalizedNotificationWorkerService } from '../../infrastructure/queue/personalized-notification-worker.service';
import { JobProcessorService } from '../../infrastructure/queue/job-processor.service';
import { NotificationsGateway } from '../../infrastructure/websocket/notifications.gateway';

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
    MuteNotificationSourceUseCase,
    MuteNotificationCategoryUseCase,
    UnmuteNotificationUseCase,
    ListNotificationMutesUseCase,
    PrismaNotificationRepository,
    PrismaNotificationPreferenceRepository,
    PrismaNotificationMuteRepository,
    PrismaAlumniRepository,
    PrismaUserInterestProfileRepository,
    PrismaUserInterestSignalRepository,
    NotificationAIScoringService,
    NotificationEligibilityService,
    MentorClusteringService,
    PersonalizedNotificationFanoutService,
    NotificationsGateway,
    {
      provide: 'NotificationsRealtimePublisher',
      useExisting: NotificationsGateway,
    },
    {
      provide: 'JobQueue',
      useClass: InProcessJobQueueService,
    },
    {
      provide: 'PersonalizedNotificationWorkerService',
      useClass: PersonalizedNotificationWorkerService,
    },
    JobProcessorService,
    {
      provide: 'NotificationRepository',
      useClass: PrismaNotificationRepository,
    },
    {
      provide: 'NotificationPreferenceRepository',
      useClass: PrismaNotificationPreferenceRepository,
    },
    {
      provide: 'NotificationMuteRepository',
      useClass: PrismaNotificationMuteRepository,
    },
    {
      provide: 'AlumniRepository',
      useClass: PrismaAlumniRepository,
    },
    {
      provide: 'UserInterestProfileRepository',
      useClass: PrismaUserInterestProfileRepository,
    },
    {
      provide: 'UserInterestSignalRepository',
      useClass: PrismaUserInterestSignalRepository,
    },
  ],
  exports: [
    CreateNotificationUseCase,
    NotificationEligibilityService,
    MentorClusteringService,
    PersonalizedNotificationFanoutService,
    NotificationsGateway,
    'UserInterestProfileRepository',
    'UserInterestSignalRepository',
    'AlumniRepository',
  ],
})
export class NotificationsModule {}
// src/domain/services/notifications-realtime-publisher.ts
import { Notification } from '../entities/notification.entity';

export interface NotificationsRealtimePublisher {
  pushNewNotification(userId: string, notification: Notification): void;
  pushUnreadCount(userId: string, unreadCount: number): void;
}
import { Notification, NotificationChannel, NotificationPreference } from '../entities/notification.entity';

export interface NotificationRepository {
  create(notification: Notification, deliveryChannels?: NotificationChannel[]): Promise<Notification>;
  findById(id: string, userId: string): Promise<Notification | null>;
  findByUserId(
    userId: string,
    options: { skip: number; take: number; unreadOnly?: boolean },
  ): Promise<{ notifications: Notification[]; total: number }>;
  countUnread(userId: string): Promise<number>;
  markAsRead(id: string, userId: string): Promise<Notification>;
  markAllAsRead(userId: string): Promise<number>;
  dismiss(id: string, userId: string): Promise<Notification>;
}

export interface NotificationPreferenceRepository {
  findByUserId(userId: string): Promise<NotificationPreference | null>;
  upsert(preference: NotificationPreference): Promise<NotificationPreference>;
}
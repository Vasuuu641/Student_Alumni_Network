import { Notification, NotificationChannel, NotificationPreference } from '../entities/notification.entity';

export interface NotificationRepository {
  create(notification: Notification, deliveryChannels?: NotificationChannel[]): Promise<Notification | null>;
  findById(id: string, userId: string): Promise<Notification | null>;
  findByUserId(
    userId: string,
    options: { skip: number; take: number; unreadOnly?: boolean },
  ): Promise<{ notifications: Notification[]; total: number }>;
  countUnread(userId: string): Promise<number>;
  markAsRead(id: string, userId: string): Promise<Notification | null>;
  markAllAsRead(userId: string): Promise<number>;
  dismiss(id: string, userId: string): Promise<Notification | null>;
  findActiveByDedupeKey(userId: string, dedupeKey: string): Promise<Notification | null>;
  updateContent(
    id: string,
    updates: {
      title?: string;
      body?: string;
      score?: number;
      metadataJson?: Record<string, unknown> | null;
      markUnread?: boolean;
    },
  ): Promise<Notification>;
}

export interface NotificationPreferenceRepository {
  findByUserId(userId: string): Promise<NotificationPreference | null>;
  upsert(preference: NotificationPreference): Promise<NotificationPreference>;
}
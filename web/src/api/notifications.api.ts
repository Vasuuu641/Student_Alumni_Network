import { api } from './http-client';

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  sourceModule: string;
  score: number;
  isRead: boolean;
  readAt: string | null;
  dismissedAt: string | null;
  actionUrl: string | null;
  dedupeKey: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export async function listNotifications(input?: {
  skip?: number;
  take?: number;
  unreadOnly?: boolean;
}): Promise<{ notifications: NotificationItem[]; total: number }> {
  const { data } = await api.get<{ notifications: NotificationItem[]; total: number }>('/notifications', {
    params: {
      skip: input?.skip ?? 0,
      take: input?.take ?? 20,
      unreadOnly: input?.unreadOnly ?? false,
    },
  });

  return data;
}

export async function getUnreadNotificationCount(): Promise<{ unreadCount: number }> {
  const { data } = await api.get<{ unreadCount: number }>('/notifications/unread-count');
  return data;
}

export async function markNotificationRead(notificationId: string): Promise<{ notification: NotificationItem }> {
  const { data } = await api.patch<{ notification: NotificationItem }>(`/notifications/${notificationId}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<{ success: boolean; count: number }> {
  const { data } = await api.patch<{ success: boolean; count: number }>('/notifications/read-all');
  return data;
}

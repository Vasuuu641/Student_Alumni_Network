import { io, Socket } from 'socket.io-client';
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

export interface NotificationMute {
  id: string;
  userId: string;
  scope: 'ENTITY' | 'CATEGORY';
  entityType: string | null;
  entityId: string | null;
  category: string | null;
  sourceModule: string;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
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

export async function dismissNotification(notificationId: string): Promise<{ notification: NotificationItem }> {
  const { data } = await api.patch<{ notification: NotificationItem }>(`/notifications/${notificationId}/dismiss`);
  return data;
}

export async function muteNotificationSource(notificationId: string): Promise<{ mute: NotificationMute }> {
  const { data } = await api.post<{ mute: NotificationMute }>(`/notifications/${notificationId}/mute-source`);
  return data;
}

export async function muteNotificationCategory(input: {
  sourceModule: string;
  category: string;
}): Promise<{ mute: NotificationMute }> {
  const { data } = await api.post<{ mute: NotificationMute }>('/notifications/mute-category', input);
  return data;
}

export async function listNotificationMutes(): Promise<{ mutes: NotificationMute[] }> {
  const { data } = await api.get<{ mutes: NotificationMute[] }>('/notifications/mutes');
  return data;
}

export async function unmuteNotification(muteId: string): Promise<{ success: boolean }> {
  const { data } = await api.patch<{ success: boolean }>(`/notifications/mutes/${muteId}`);
  return data;
}

export async function getNotificationPreferences(): Promise<{ preferences: NotificationPreferences }> {
  const { data } = await api.get<{ preferences: NotificationPreferences }>('/notifications/preferences');
  return data;
}

export async function updateNotificationPreferences(input: {
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
}): Promise<{ preferences: NotificationPreferences }> {
  const { data } = await api.patch<{ preferences: NotificationPreferences }>('/notifications/preferences', input);
  return data;
}

export function createNotificationsSocket(token: string): Socket {
  const rawUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
  const url = rawUrl.replace(/\/$/, '');

  return io(`${url}/notifications`, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    timeout: 10000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    auth: { token },
  });
}
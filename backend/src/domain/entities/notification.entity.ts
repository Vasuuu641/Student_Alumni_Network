export enum NotificationType {
  THREAD_REPLY = 'THREAD_REPLY',
  THREAD_ACTIVITY = 'THREAD_ACTIVITY',
  GEO_HELP_ACTIVITY = 'GEO_HELP_ACTIVITY',
  STUDY_GROUP_ACTIVITY = 'STUDY_GROUP_ACTIVITY',
  NOTE_ACTIVITY = 'NOTE_ACTIVITY',
  SYSTEM = 'SYSTEM',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
}

export enum NotificationDeliveryStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export class Notification {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly type: NotificationType,
    public title: string,
    public body: string,
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly sourceModule: string,
    public score: number,
    public isRead: boolean,
    public readAt: Date | null,
    public dismissedAt: Date | null,
    public readonly actionUrl: string | null,
    public readonly dedupeKey: string | null,
    public readonly metadataJson: Record<string, unknown> | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  markAsRead(at: Date = new Date()): void {
    this.isRead = true;
    this.readAt = at;
  }

  dismiss(at: Date = new Date()): void {
    this.dismissedAt = at;
  }
}

export class NotificationPreference {
  constructor(
    public readonly userId: string,
    public inAppEnabled: boolean,
    public emailEnabled: boolean,
    public pushEnabled: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
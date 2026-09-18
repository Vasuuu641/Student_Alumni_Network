// src/domain/entities/notification-mute.entity.ts
export enum NotificationMuteScope {
  ENTITY = 'ENTITY',
  CATEGORY = 'CATEGORY',
}

export class NotificationMute {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly scope: NotificationMuteScope,
    public readonly entityType: string | null,
    public readonly entityId: string | null,
    public readonly category: string | null,
    public readonly sourceModule: string,
    public readonly createdAt: Date,
  ) {}
}
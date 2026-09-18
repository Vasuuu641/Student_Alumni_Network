// src/domain/repositories/notification-mute.repository.ts
import { NotificationMute } from '../entities/notification-mute.entity';

export interface NotificationMuteRepository {
  create(mute: NotificationMute): Promise<NotificationMute>;
  delete(id: string, userId: string): Promise<boolean>;
  findByUserId(userId: string): Promise<NotificationMute[]>;
  isEntityMuted(userId: string, entityType: string, entityId: string): Promise<boolean>;
  isCategoryMuted(userId: string, sourceModule: string, category: string): Promise<boolean>;
}
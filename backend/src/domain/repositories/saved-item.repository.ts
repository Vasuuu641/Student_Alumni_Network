// src/domain/repositories/saved-item.repository.ts
import { SavedItem } from '../entities/saved-item.entity';

export interface SavedItemRepository {
  save(item: SavedItem): Promise<SavedItem>;
  unsave(userId: string, entityType: string, entityId: string): Promise<boolean>;
  isSaved(userId: string, entityType: string, entityId: string): Promise<boolean>;
  findByUserId(userId: string, entityType: string): Promise<SavedItem[]>;
}
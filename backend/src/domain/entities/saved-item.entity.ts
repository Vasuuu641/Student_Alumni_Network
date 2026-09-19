// src/domain/entities/saved-item.entity.ts
export class SavedItem {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly createdAt: Date,
  ) {}
}
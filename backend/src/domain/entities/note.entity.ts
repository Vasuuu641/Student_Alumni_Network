export enum NoteStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export enum NotePermissionRole {
    OWNER = 'OWNER',
    EDITOR = 'EDITOR',
    VIEWER = 'VIEWER',
}

export class Note {
  constructor(
    public readonly id: string,
    public title: string,
    public readonly ownerId: string,
    public status: NoteStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  isOwnedBy(userId: string): boolean {
    return this.ownerId === userId;
  }
}
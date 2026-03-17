import { NotePermissionRole } from './note.entity';

export class NoteCollaborator {
  constructor(
    public readonly noteId: string,
    public readonly userId: string,
    public role: NotePermissionRole,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}

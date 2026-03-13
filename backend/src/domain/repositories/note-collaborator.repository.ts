import { NoteCollaborator } from '../entities/note-collaborator.entity';
import { NotePermissionRole } from '../entities/note.entity';

export interface NoteCollaboratorRepository {
  findByNoteId(noteId: string): Promise<NoteCollaborator[]>;
  findByNoteAndUser(noteId: string, userId: string): Promise<NoteCollaborator | null>;
  add(collaborator: NoteCollaborator): Promise<NoteCollaborator>;
  updateRole(noteId: string, userId: string, role: NotePermissionRole): Promise<NoteCollaborator>;
  remove(noteId: string, userId: string): Promise<void>;
}

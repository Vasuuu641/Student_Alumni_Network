import { Note, NoteStatus } from '../entities/note.entity';

export interface NoteRepository {
  findById(id: string): Promise<Note | null>;
  findByOwnerId(ownerId: string): Promise<Note[]>;
  findByUserCollaboration(userId: string): Promise<Note[]>;
  create(note: Note): Promise<Note>;
  update(note: Note): Promise<Note>;
  updateStatus(noteId: string, status: NoteStatus): Promise<Note>;
  delete(noteId: string): Promise<void>;
}

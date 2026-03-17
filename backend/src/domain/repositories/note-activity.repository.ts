import { NoteActivity } from '../entities/note-activity.entity';

export interface NoteActivityRepository {
  create(activity: NoteActivity): Promise<NoteActivity>;
  findByNoteId(noteId: string, limit?: number, offset?: number): Promise<NoteActivity[]>;
  findByActorId(actorId: string, limit?: number, offset?: number): Promise<NoteActivity[]>;
  findRecent(limit?: number, offset?: number): Promise<NoteActivity[]>;
  countByNoteId(noteId: string): Promise<number>;
  deleteByNoteId(noteId: string): Promise<void>; // for cleanup when note is deleted
}
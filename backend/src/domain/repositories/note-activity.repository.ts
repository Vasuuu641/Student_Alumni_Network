import { NoteActivity } from '../entities/note-activity.entity';

export interface NoteActivityRepository {
  create(activity: NoteActivity): Promise<NoteActivity>;
  findByNoteId(noteId: string, limit?: number, offset?: number): Promise<NoteActivity[]>;
}

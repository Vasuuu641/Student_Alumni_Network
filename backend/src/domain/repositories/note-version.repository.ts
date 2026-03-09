import { NoteVersion } from '../entities/note-version.entity';

export interface NoteVersionRepository {
  create(version: NoteVersion): Promise<NoteVersion>;
  findById(id: string): Promise<NoteVersion | null>;
  findByNoteId(noteId: string): Promise<NoteVersion[]>;
  findLatestByNoteId(noteId: string): Promise<NoteVersion | null>;
  findByNoteIdAndVersionNumber(noteId: string, versionNumber: number): Promise<NoteVersion | null>;
}

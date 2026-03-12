//Show version history for audit/restore UI - controlled paginated access to historical states
import { Injectable, Inject } from '@nestjs/common';
import type { NoteVersion } from 'src/domain/entities/note-version.entity';
import type { NoteVersionRepository } from 'src/domain/repositories/note-version.repository';

@Injectable()
export class ListNoteVersionsUseCase {
  constructor(@Inject('NoteVersionRepository') private noteVersionRepository: NoteVersionRepository) {}

  async execute(noteId: string, page: number = 1, pageSize: number = 10): Promise<NoteVersion[]> {
    const offset = (page - 1) * pageSize;
    return this.noteVersionRepository.listVersions(noteId, offset, pageSize);
  }
}   

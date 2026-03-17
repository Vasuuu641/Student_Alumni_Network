//Show version history for audit/restore UI - controlled paginated access to historical states
import { Injectable, Inject } from '@nestjs/common';
import type { NoteRepository } from 'src/domain/repositories/note.repository';
import type { NoteCollaboratorRepository } from 'src/domain/repositories/note-collaborator.repository';
import type { NoteVersion } from 'src/domain/entities/note-version.entity';
import type { NoteVersionRepository } from 'src/domain/repositories/note-version.repository';

@Injectable()
export class ListNoteVersionsUseCase {
  constructor(
    @Inject('NoteVersionRepository')
    private readonly noteVersionRepository: NoteVersionRepository,
    @Inject('NoteRepository')
    private readonly noteRepository: NoteRepository,
    @Inject('NoteCollaboratorRepository')
    private readonly noteCollaboratorRepository: NoteCollaboratorRepository,
  ) {}

  async execute(
    noteId: string,
    actorId: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<NoteVersion[]> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    const isOwner = note.ownerId === actorId;
    if (!isOwner) {
      const collaborator = await this.noteCollaboratorRepository.findByNoteAndUser(
        noteId,
        actorId,
      );
      if (!collaborator) {
        throw new Error('User does not have access to this note versions history');
      }
    }

    const offset = (page - 1) * pageSize;
    return this.noteVersionRepository.listVersions(noteId, offset, pageSize);
  }
}   

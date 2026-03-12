//Getting an already exisiting note by id only if user has access to it
import { Injectable, Inject } from '@nestjs/common';
import type { NoteRepository } from 'src/domain/repositories/note.repository';
import type { NoteCollaboratorRepository } from 'src/domain/repositories/note-collaborator.repository';
import type { NoteVersionRepository } from 'src/domain/repositories/note-version.repository';
import type { Note } from 'src/domain/entities/note.entity';

export interface GetNoteResult {
  id: string;
  title: string;
  ownerId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  content: unknown | null;
  latestVersionNumber: number | null;
  latestVersionCreatedAt: Date | null;
}

@Injectable()
export class GetNoteUseCase {
  constructor(
    @Inject('NoteRepository') private readonly noteRepository: NoteRepository,
    @Inject('NoteCollaboratorRepository') private readonly noteCollaboratorRepository: NoteCollaboratorRepository,
    @Inject('NoteVersionRepository') private readonly noteVersionRepository: NoteVersionRepository,
  ) {}
  
  async execute(noteId: string, userId: string): Promise<GetNoteResult> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note with ID ${noteId} not found`);
    }
    // Allow access to the owner or any collaborator
    if (!note.isOwnedBy(userId)) {
      const collaborator = await this.noteCollaboratorRepository.findByNoteAndUser(noteId, userId);
      if (!collaborator) {
        throw new Error(`User does not have access to note with ID ${noteId}`);
      }
    }

    const latestVersion = await this.noteVersionRepository.findLatestByNoteId(noteId);

    return {
      id: note.id,
      title: note.title,
      ownerId: note.ownerId,
      status: note.status,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      content: latestVersion?.snapshotJson ?? null,
      latestVersionNumber: latestVersion?.versionNumber ?? null,
      latestVersionCreatedAt: latestVersion?.createdAt ?? null,
    };
  }
}
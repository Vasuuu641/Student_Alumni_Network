// Getting an already existing note by id only if user has access to it
import { Injectable, Inject } from '@nestjs/common';
import type { NoteRepository } from 'src/domain/repositories/note.repository';
import type { NoteCollaboratorRepository } from 'src/domain/repositories/note-collaborator.repository';
import type { NoteVersionRepository } from 'src/domain/repositories/note-version.repository';

export interface GetNoteResult {
  id: string;
  title: string;
  ownerId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  // Live autosaved content — written by UpdateNoteUseCase on every autosave
  content: unknown | null;
  // Latest checkpoint metadata — for version history UI only
  latestVersionNumber: number | null;
  latestVersionCreatedAt: Date | null;
}

@Injectable()
export class GetNoteUseCase {
  constructor(
    @Inject('NoteRepository')
    private readonly noteRepository: NoteRepository,
    @Inject('NoteCollaboratorRepository')
    private readonly noteCollaboratorRepository: NoteCollaboratorRepository,
    @Inject('NoteVersionRepository')
    private readonly noteVersionRepository: NoteVersionRepository,
  ) {}

  async execute(noteId: string, userId: string): Promise<GetNoteResult> {
    const note = await this.noteRepository.findById(noteId)
    if (!note) {
      throw new Error(`Note with ID ${noteId} not found`)
    }

    // Allow access to owner or any collaborator
    if (!note.isOwnedBy(userId)) {
      const collaborator = await this.noteCollaboratorRepository
        .findByNoteAndUser(noteId, userId)
      if (!collaborator) {
        throw new Error(`User does not have access to note with ID ${noteId}`)
      }
    }

    const latestVersion = await this.noteVersionRepository.findLatestByNoteId(noteId)

    return {
      id: note.id,
      title: note.title,
      ownerId: note.ownerId,
      status: note.status,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      // Fix — return live note content, not the last checkpoint snapshot.
      // note.content is kept current by UpdateNoteUseCase on every autosave.
      // Falling back to latestVersion.snapshotJson means users who haven't
      // explicitly saved a checkpoint see null content on every page load.
      content: note.content ?? latestVersion?.snapshotJson ?? null,
      latestVersionNumber: latestVersion?.versionNumber ?? null,
      latestVersionCreatedAt: latestVersion?.createdAt ?? null,
    }
  }
}
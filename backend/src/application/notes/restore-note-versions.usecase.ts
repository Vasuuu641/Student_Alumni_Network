//Restore a selected version of a note by creating a new headstate not deleting the history. 
//Preserves the audit trail and avoids destructive rollback
import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NoteVersion } from 'src/domain/entities/note-version.entity';
import { NotePermissionRole } from 'src/domain/entities/note.entity';
import type { NoteRepository } from 'src/domain/repositories/note.repository';
import type { NoteCollaboratorRepository } from 'src/domain/repositories/note-collaborator.repository';
import type { NoteVersionRepository } from 'src/domain/repositories/note-version.repository';
import type { NoteActivityRepository } from 'src/domain/repositories/note-activity.repository';

@Injectable()
export class RestoreNoteVersionsUseCase {
  constructor(
    @Inject('NoteVersionRepository')
    private readonly noteVersionRepository: NoteVersionRepository,
    @Inject('NoteRepository')
    private readonly noteRepository: NoteRepository,
    @Inject('NoteCollaboratorRepository')
    private readonly noteCollaboratorRepository: NoteCollaboratorRepository,
    @Inject('NoteActivityRepository')
    private readonly noteActivityRepository: NoteActivityRepository,
  ) {}

  async execute(noteId: string, versionNumber: number, actorId: string): Promise<NoteVersion> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    const isOwner = note.ownerId === actorId;
    let isEditor = false;
    if (!isOwner) {
      const collaborator = await this.noteCollaboratorRepository.findByNoteAndUser(
        noteId,
        actorId,
      );
      isEditor = collaborator?.role === NotePermissionRole.EDITOR;
    }

    if (!isOwner && !isEditor) {
      throw new Error('User does not have permission to restore this note version');
    }

    const versionToRestore = await this.noteVersionRepository.findByNoteIdAndVersionNumber(noteId, versionNumber);
    if (!versionToRestore) {
      throw new Error("Note version not found");
    }

    // Create a new version with the content of the selected version to restore
    const latestVersion = await this.noteVersionRepository.findLatestByNoteId(noteId);
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
    const newVersion = new NoteVersion(
      randomUUID(),
      noteId,
      nextVersionNumber,
      versionToRestore.snapshotJson,
      actorId,
      new Date(),
    );

    const restoredVersion = await this.noteVersionRepository.create(newVersion);

    await this.noteActivityRepository.create({
      id: randomUUID(),
      noteId,
      actorId,
      action: 'RESTORE_VERSION',
      metadataJson: {
        restoredFromVersionNumber: versionNumber,
        restoredToVersionNumber: nextVersionNumber,
      },
      createdAt: new Date(),
    });

    await this.noteRepository.update(note);

    return restoredVersion;
  }
}
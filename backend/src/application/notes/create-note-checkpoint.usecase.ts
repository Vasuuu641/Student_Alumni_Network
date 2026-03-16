// Create an explicit version checkpoint for a note.
import { Injectable, Inject } from '@nestjs/common';
import { NoteVersion } from 'src/domain/entities/note-version.entity';
import type { NoteRepository } from 'src/domain/repositories/note.repository';
import type { NoteVersionRepository } from 'src/domain/repositories/note-version.repository';
import type { NoteActivityRepository } from 'src/domain/repositories/note-activity.repository';
import type { NoteCollaboratorRepository } from 'src/domain/repositories/note-collaborator.repository';
import { NotePermissionRole } from 'src/domain/entities/note.entity';

@Injectable()
export class CreateNoteCheckpointUseCase {
  constructor(
    @Inject('NoteRepository') private readonly noteRepository: NoteRepository,
    @Inject('NoteVersionRepository') private readonly noteVersionRepository: NoteVersionRepository,
    @Inject('NoteActivityRepository') private readonly noteActivityRepository: NoteActivityRepository,
    @Inject('NoteCollaboratorRepository')
    private readonly noteCollaboratorRepository: NoteCollaboratorRepository,
  ) {}

  async execute(noteId: string, actorId: string): Promise<void> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    // OWNER or EDITOR can create checkpoints.
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
      throw new Error('User does not have permission to create checkpoints');
    }

    // Checkpoint snapshot is the latest persisted content.
    const latestVersion = await this.noteVersionRepository.findLatestByNoteId(noteId);
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
    const snapshotJson = latestVersion?.snapshotJson ?? {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };

    await this.noteVersionRepository.create(
      new NoteVersion(
        this.generateUniqueId(),
        noteId,
        nextVersionNumber,
        snapshotJson,
        actorId,
        new Date(),
      ),
    );

    // Create a checkpoint activity
    await this.noteActivityRepository.create({
      id: this.generateUniqueId(),
      noteId,
      actorId,
      action: 'CREATE_CHECKPOINT',
      metadataJson: { versionNumber: nextVersionNumber },
      createdAt: new Date(),
    });
  }

  private generateUniqueId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}
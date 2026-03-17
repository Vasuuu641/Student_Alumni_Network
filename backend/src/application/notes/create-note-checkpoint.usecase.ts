// Create an explicit version checkpoint for a note.
import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
    const note = await this.noteRepository.findById(noteId)
    if (!note) throw new Error('Note not found')

    // OWNER or EDITOR can create checkpoints
    const isOwner = note.ownerId === actorId
    if (!isOwner) {
      const collaborator = await this.noteCollaboratorRepository.findByNoteAndUser(
        noteId,
        actorId,
      )
      const isEditor = collaborator?.role === NotePermissionRole.EDITOR
      if (!isEditor) {
        throw new Error('User does not have permission to create checkpoints')
      }
    }

    // Snapshot the CURRENT note content, not the previous version's content
    // note.content is populated by UpdateNoteUseCase on every autosave
    const snapshotJson = note.content ?? {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    }

    const latestVersion = await this.noteVersionRepository.findLatestByNoteId(noteId)
    const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1

    await this.noteVersionRepository.create(
      new NoteVersion(
        randomUUID(),
        noteId,
        nextVersionNumber,
        snapshotJson,
        actorId,
        new Date(),
      ),
    )

    await this.noteActivityRepository.create({
      id: randomUUID(),
      noteId,
      actorId,
      action: 'CREATE_CHECKPOINT',
      metadataJson: { versionNumber: nextVersionNumber },
      createdAt: new Date(),
    })
  }
}
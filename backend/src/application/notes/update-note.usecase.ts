import { Injectable, Inject } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { NoteRepository } from "src/domain/repositories/note.repository";
import type { NoteActivityRepository } from "src/domain/repositories/note-activity.repository";
import type { NoteCollaboratorRepository } from "src/domain/repositories/note-collaborator.repository";
import type { NoteLLMService } from "src/domain/services/note-llm-service";

const MAX_NOTE_CONTENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

@Injectable()
export class UpdateNoteUseCase {
  constructor(
    @Inject('NoteRepository') private readonly noteRepository: NoteRepository,
    @Inject('NoteActivityRepository') private readonly noteActivityRepository: NoteActivityRepository,
    @Inject('NoteCollaboratorRepository') private readonly noteCollaboratorRepository: NoteCollaboratorRepository,
    @Inject('NoteLLMService') private readonly noteLLMService: NoteLLMService,
  ) {}

  async execute(
    noteId: string,
    actorId: string,
    contentJson: any,
  ): Promise<void> {
    // Validate content size
    const contentSize = JSON.stringify(contentJson).length
    if (contentSize > MAX_NOTE_CONTENT_SIZE_BYTES) {
      throw new Error(
        `Note content exceeds maximum size of ${MAX_NOTE_CONTENT_SIZE_BYTES / 1024 / 1024}MB`
      )
    }

    // Fetch note
    const note = await this.noteRepository.findById(noteId)
    if (!note) throw new Error('Note not found')

    // Permission check: must be OWNER or EDITOR
    const isOwner = note.ownerId === actorId
    if (!isOwner) {
      const collaborator = await this.noteCollaboratorRepository.findByNoteAndUser(
        noteId,
        actorId,
      )
      const isEditor = collaborator !== null && collaborator.role === 'EDITOR'
      if (!isEditor) {
        throw new Error('User does not have permission to edit this note content')
      }
    }

    // Assign content onto the entity so the repository persists it
    // into the contentJson column — this is what was missing before
    note.content = contentJson

    // Persist — updatedAt is handled by Prisma @updatedAt
    await this.noteRepository.update(note)

    // Activity log — no version number needed here, versions are
    // created explicitly via CreateNoteCheckpointUseCase only
    await this.noteActivityRepository.create({
      id: randomUUID(),
      noteId,
      actorId,
      action: 'UPDATE_CONTENT',
      metadataJson: null,
      createdAt: new Date(),
    })

    // Re-embed in background with updated content
    this.noteLLMService.embedNote(noteId, note.title, contentJson).catch((err) => {
      console.error(`Background re-embed failed for note ${noteId}:`, err.message);
    });
  }
}
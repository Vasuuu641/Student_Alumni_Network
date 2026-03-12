//Update note content (rich-text/JSON). Distinct from metadata updates - allows collaborative content editing
import { Injectable, Inject } from "@nestjs/common";
import type { NoteRepository } from "src/domain/repositories/note.repository";
import type { NoteVersionRepository } from "src/domain/repositories/note-version.repository";
import type { NoteActivityRepository } from "src/domain/repositories/note-activity.repository";
import type { NoteCollaboratorRepository } from "src/domain/repositories/note-collaborator.repository";
import { NoteVersion } from "src/domain/entities/note-version.entity";

// Constants
const MAX_NOTE_CONTENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

@Injectable()
export class UpdateNoteUseCase {
  constructor(
    @Inject('NoteRepository') private readonly noteRepository: NoteRepository,
    @Inject('NoteVersionRepository') private readonly noteVersionRepository: NoteVersionRepository,
    @Inject('NoteActivityRepository') private readonly noteActivityRepository: NoteActivityRepository,
    @Inject('NoteCollaboratorRepository') private readonly noteCollaboratorRepository: NoteCollaboratorRepository
  ) {}

  async execute(
    noteId: string,
    actorId: string,
    contentJson: any
  ): Promise<void> {
    // Validate content size
    const contentSize = JSON.stringify(contentJson).length;
    if (contentSize > MAX_NOTE_CONTENT_SIZE_BYTES) {
      throw new Error(
        `Note content exceeds maximum size of ${MAX_NOTE_CONTENT_SIZE_BYTES / 1024 / 1024}MB`
      );
    }

    // Get the current note to verify existence
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    // Permission check: User must be OWNER or EDITOR
    const isOwner = note.ownerId === actorId;
    
    let isEditor = false;
    if (!isOwner) {
      // Check if user is a collaborator with EDITOR role
      const collaborator = await this.noteCollaboratorRepository.findByNoteAndUser(
        noteId,
        actorId
      );
      isEditor = collaborator !== null && collaborator.role === "EDITOR";
    }

    if (!isOwner && !isEditor) {
      throw new Error(
        "User does not have permission to edit this note content"
      );
    }

    // Create a new version checkpoint with the updated content
    const latestVersion =
      await this.noteVersionRepository.findLatestByNoteId(noteId);
    const nextVersionNumber = latestVersion
      ? latestVersion.versionNumber + 1
      : 1;

    const newVersion = new NoteVersion(
      this.generateUniqueId(),
      noteId,
      nextVersionNumber,
      contentJson,
      actorId,
      new Date()
    );

    // Save the version
    await this.noteVersionRepository.create(newVersion);

    // Create activity log entry
    await this.noteActivityRepository.create({
      id: this.generateUniqueId(),
      noteId,
      actorId,
      action: "UPDATE_CONTENT",
      metadataJson: {
        versionNumber: nextVersionNumber,
      },
      createdAt: new Date(),
    });
  }

  private generateUniqueId(): string {
    // Simple unique ID generator
    return Math.random().toString(36).substr(2, 9);
  }
}

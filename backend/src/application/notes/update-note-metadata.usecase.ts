//update note metadata (title/status), not collaborative content stream. Seperates document metadata rules
//from realtime editor updates - cleaner permissions and auditing

import { Injectable } from "@nestjs/common";
import type { NoteRepository } from "src/domain/repositories/note.repository";
import type { NoteActivityRepository } from "src/domain/repositories/note-activity.repository";

// Constants
const MAX_TITLE_LENGTH = 500;

@Injectable()
export class UpdateNoteMetadataUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly noteActivityRepository: NoteActivityRepository
  ) {}

  async execute(noteId: string, actorId: string, title?: string, status?: string): Promise<void> {
    // Validate title length if provided
    if (title && title.length > MAX_TITLE_LENGTH) {
      throw new Error(
        `Note title exceeds maximum length of ${MAX_TITLE_LENGTH} characters`
      );
    }

    // Verify note exists and user has permission (owner can always update metadata)
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    if (note.ownerId !== actorId) {
      throw new Error("Only the note owner can update note metadata");
    }

    // Update the note metadata
    await this.noteRepository.updateMetadata(noteId, { title, status });

    // Create an activity log for the metadata update
    await this.noteActivityRepository.create({
      id: this.generateUniqueId(),
      noteId,
      actorId,
      action: "UPDATE_METADATA",
      metadataJson: { title, status },
      createdAt: new Date(),
    });
  }

  private generateUniqueId(): string {
    // Simple unique ID generator (for demonstration purposes)
    return Math.random().toString(36).substr(2, 9);
  }
}
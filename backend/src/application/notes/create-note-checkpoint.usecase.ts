//Creating a note usecase
import { Injectable, Inject } from "@nestjs/common";
import type { NoteRepository } from "src/domain/repositories/note.repository";
import type { NoteActivityRepository } from "src/domain/repositories/note-activity.repository";

@Injectable()
export class CreateNoteCheckpointUseCase {
  constructor(
    @Inject('NoteRepository') private readonly noteRepository: NoteRepository,
    @Inject('NoteActivityRepository') private readonly noteActivityRepository: NoteActivityRepository
  ) {}

  async execute(noteId: string, actorId: string): Promise<void> {
    // Create a checkpoint activity for the note creation
    await this.noteActivityRepository.create({
      id: this.generateUniqueId(),
      noteId,
      actorId,
      action: "CREATE_CHECKPOINT",
      metadataJson: {},
      createdAt: new Date(),
    });
  }

  private generateUniqueId(): string {
    // Simple unique ID generator (for demonstration purposes)
    return Math.random().toString(36).substr(2, 9);
  }
}
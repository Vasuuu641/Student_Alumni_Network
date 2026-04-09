//Creates a note for a user
import { Injectable, Inject } from "@nestjs/common";
import type { NoteRepository } from "src/domain/repositories/note.repository";
import type { NoteActivityRepository } from "src/domain/repositories/note-activity.repository";
import { NoteStatus } from "src/domain/entities/note.entity";
import type { NoteLLMService } from "src/domain/services/note-llm-service";

@Injectable()
export class CreateNoteUseCase {
  constructor(
    @Inject('NoteRepository') private readonly noteRepository: NoteRepository,
    @Inject('NoteActivityRepository') private readonly noteActivityRepository: NoteActivityRepository,
    @Inject('NoteLLMService') private readonly noteLLMService: NoteLLMService
  ) {}

  async execute(userId: string, title: string): Promise<string> {
    const now = new Date();

    // Create the note
    const note = await this.noteRepository.create({
      id: this.generateUniqueId(),
      title,
      ownerId: userId,
      status: NoteStatus.ACTIVE,
      content: null,
      createdAt: now,
      updatedAt: now,
      isOwnedBy: (checkUserId: string) => userId === checkUserId,
    });

    // Create a checkpoint activity for the note creation
    await this.noteActivityRepository.create({
      id: this.generateUniqueId(),
      noteId: note.id,
      actorId: userId,
      action: "CREATE",
      metadataJson: {},
      createdAt: now,
    });

     // Embed in background — title only since content is empty on creation
    this.noteLLMService.embedNote(note.id, title, null).catch((err) => {
      console.error(`Background embed failed for note ${note.id}:`, err.message);
    });

    return note.id;
  }

  private generateUniqueId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}
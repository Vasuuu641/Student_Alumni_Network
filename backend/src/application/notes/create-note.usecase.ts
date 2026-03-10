//Creates a note for a user
import { Injectable } from "@nestjs/common";
import type { NoteRepository } from "src/domain/repositories/note.repository";
import type { NoteActivityRepository } from "src/domain/repositories/note-activity.repository";
import { NoteStatus } from "src/domain/entities/note.entity";

@Injectable()
export class CreateNoteUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly noteActivityRepository: NoteActivityRepository
  ) {}

  async execute(userId: string, title: string): Promise<string> {
    const now = new Date();

    // Create the note
    const note = await this.noteRepository.create({
      id: this.generateUniqueId(),
      title,
      ownerId: userId,
      status: NoteStatus.ACTIVE,
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

    return note.id;
  }

  private generateUniqueId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}
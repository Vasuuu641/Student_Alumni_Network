//return all notes of a user - owned + shared with him
import type { NoteRepository } from "src/domain/repositories/note.repository";
import type { Note } from "src/domain/entities/note.entity";
import { Injectable, Inject } from "@nestjs/common";

@Injectable()
export class ListUserNotesUseCase {
  constructor(@Inject('NoteRepository') private noteRepository: NoteRepository) {}

  async execute(userId: string): Promise<Note[]> {
    // Fetch notes owned by the user
    const ownedNotes = await this.noteRepository.findByOwnerId(userId);

    // Fetch notes shared with the user
    const sharedNotes = await this.noteRepository.findByUserCollaboration(userId);

    // Combine and return unique notes
    const allNotesMap = new Map<string, Note>();
    ownedNotes.forEach(note => allNotesMap.set(note.id, note));
    sharedNotes.forEach(note => allNotesMap.set(note.id, note));

    return Array.from(allNotesMap.values());
  }
}
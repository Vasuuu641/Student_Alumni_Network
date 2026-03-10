//Getting an already exisiting note by id only if user has access to it
import { Injectable } from '@nestjs/common';
import type { NoteRepository } from 'src/domain/repositories/note.repository';
import type { Note } from 'src/domain/entities/note.entity';

@Injectable()
export class GetNoteUseCase {
  constructor(private readonly noteRepository: NoteRepository) {}
  
  //if note is not found, throw exception
  async execute(noteId: string, userId: string): Promise<Note | null> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note with ID ${noteId} not found`);
    }
    if (!note.isOwnedBy(userId)) {
      throw new Error(`User with ID ${userId} does not have access to note with ID ${noteId}`);
    }
    return note;
  }

  
}
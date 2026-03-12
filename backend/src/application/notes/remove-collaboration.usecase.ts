//Provoking user's access to a note after sharing it with them. The owner can remove the user from the note's collaborators, which will revoke their access to the note.
import type { NoteRepository } from "src/domain/repositories/note.repository";
import type { UserRepository } from "src/domain/repositories/user.repository";
import type { NoteCollaboratorRepository } from "src/domain/repositories/note-collaborator.repository";
import { Email } from "src/domain/value-objects/email.vo";
import { Injectable } from "@nestjs/common";

@Injectable()
export class RemoveCollaboratorUseCase {
  constructor(
    private noteRepository: NoteRepository,
    private userRepository: UserRepository,
    private noteCollaboratorRepository: NoteCollaboratorRepository 
  ) {}

  async execute(noteId: string, ownerId: string, collaboratorEmail: string) {
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    // Ensure only the owner can remove collaborators
    if (note.ownerId !== ownerId) {
      throw new Error("Only the note owner can remove collaborators");
    }

    const emailVO = new Email(collaboratorEmail);
    const collaborator = await this.userRepository.findByEmail(emailVO);
    if (!collaborator) {
      throw new Error("Collaborator not found");
    }

    // Prevent owner from removing themselves
    if (collaborator.id === ownerId) {
      throw new Error("Owner cannot be removed as a collaborator");
    }

    const existingCollaborator = await this.noteCollaboratorRepository.findByNoteAndUser(
      noteId,
      collaborator.id
    );

    if (!existingCollaborator) {
      throw new Error("Collaborator does not have access to this note");
    }

    await this.noteCollaboratorRepository.remove(noteId, collaborator.id);
  }
}
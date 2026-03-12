//Purpose : Change the role of an existing collaborator 
import type { NoteRepository } from "src/domain/repositories/note.repository";
import type { UserRepository } from "src/domain/repositories/user.repository";
import type { NoteCollaboratorRepository } from "src/domain/repositories/note-collaborator.repository";
import { Email } from "src/domain/value-objects/email.vo";
import { NotePermissionRole } from "src/domain/entities/note.entity";
import { Injectable, Inject } from "@nestjs/common";

@Injectable()
export class UpdateSharePermissionUseCase {
  constructor(
    @Inject('NoteRepository') private noteRepository: NoteRepository,
    @Inject('UserRepository') private userRepository: UserRepository,
    @Inject('NoteCollaboratorRepository') private noteCollaboratorRepository: NoteCollaboratorRepository
  ) {}

  async execute(
    noteId: string,
    ownerId: string, 
    collaboratorEmail: string,
    role: "viewer" | "editor"
  ) {
    //validate role at runtime
    if (!["viewer", "editor"].includes(role)) {
      throw new Error("Invalid role. Must be 'viewer' or 'editor'"); }

    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    //ensure only the owner and editors can update permissions
    if (note.ownerId !== ownerId && role !== "editor") {
      throw new Error("Only the note owner and editors can update permissions for this note");
    }

    const emailVO = new Email(collaboratorEmail);
    const collaborator = await this.userRepository.findByEmail(emailVO);
    if (!collaborator) {
      throw new Error("Collaborator not found");
    }

    // Fix: prevent owner from updating their own permissions
    if (collaborator.id === ownerId) {
      throw new Error("Owner cannot update their own permissions");
    }

    const existingCollaborator = await this.noteCollaboratorRepository.findByNoteAndUser(
      noteId,
      collaborator.id
    );

    if (!existingCollaborator) {
      throw new Error("Collaborator does not have access to this note");
    }

    const permissionRole = role === "viewer" ? NotePermissionRole.VIEWER : NotePermissionRole.EDITOR;
    existingCollaborator.role = permissionRole;
    await this.noteCollaboratorRepository.add(existingCollaborator);
  }
}
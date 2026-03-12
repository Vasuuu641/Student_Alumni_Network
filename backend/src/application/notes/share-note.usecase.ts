import type { NoteRepository } from "src/domain/repositories/note.repository";
import type { UserRepository } from "src/domain/repositories/user.repository";
import type { NoteCollaboratorRepository } from "src/domain/repositories/note-collaborator.repository";
import { Email } from "src/domain/value-objects/email.vo";
import { NotePermissionRole } from "src/domain/entities/note.entity";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ShareNoteUseCase {
  constructor(
    private noteRepository: NoteRepository,
    private userRepository: UserRepository,
    private noteCollaboratorRepository: NoteCollaboratorRepository // Fix: correct type
  ) {}

  async execute(
    noteId: string,
    ownerId: string, // Fix: added to verify ownership
    collaboratorEmail: string,
    role: "viewer" | "editor"
  ) {
    // Fix: validate role at runtime
    if (!["viewer", "editor"].includes(role)) {
      throw new Error("Invalid role. Must be 'viewer' or 'editor'");
    }

    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    // Fix: ensure only the owner and editors can share the note
    if (note.ownerId !== ownerId && role !== "editor") {
      throw new Error("Only the note owner and editors can share this note");
    }

    const emailVO = new Email(collaboratorEmail);
    const collaborator = await this.userRepository.findByEmail(emailVO);
    if (!collaborator) {
      throw new Error("Collaborator not found");
    }

    // Fix: prevent owner from adding themselves as a collaborator
    if (collaborator.id === ownerId) {
      throw new Error("Owner cannot be added as a collaborator");
    }

    const existingCollaborator = await this.noteCollaboratorRepository.findByNoteAndUser(
      noteId,
      collaborator.id
    );

    const permissionRole = role === "viewer" ? NotePermissionRole.VIEWER : NotePermissionRole.EDITOR;

    if (existingCollaborator) {
      existingCollaborator.role = permissionRole;
      await this.noteCollaboratorRepository.add(existingCollaborator);
    } else {
      const now = new Date();
      await this.noteCollaboratorRepository.add({
        noteId,
        userId: collaborator.id,
        role: permissionRole,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}
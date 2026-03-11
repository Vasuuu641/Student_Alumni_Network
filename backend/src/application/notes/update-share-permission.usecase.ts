//Purpose : Change the role of an existing collaborator 
import { NoteRepository } from "../../domain/repositories/note.repository";
import { UserRepository } from "../../domain/repositories/user.repository";
import { NoteCollaboratorRepository } from "../../domain/repositories/note-collaborator.repository"; // Fix: use a repository, not entity
import { Email } from "../../domain/value-objects/email.vo";
import { NotePermissionRole } from "../../domain/entities/note.entity";

export class UpdateSharePermissionUseCase {
  constructor(
    private noteRepository: NoteRepository,
    private userRepository: UserRepository,
    private noteCollaboratorRepository: NoteCollaboratorRepository 
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
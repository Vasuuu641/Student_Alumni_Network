import { Injectable, Inject } from '@nestjs/common';
import type { NoteRepository } from 'src/domain/repositories/note.repository';
import type { NoteCollaboratorRepository } from 'src/domain/repositories/note-collaborator.repository';
import type { UserRepository } from 'src/domain/repositories/user.repository';
import { NotePermissionRole } from 'src/domain/entities/note.entity';

export interface NoteCollaboratorListItem {
  userId: string;
  email: string;
  displayName: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
}

@Injectable()
export class ListNoteCollaboratorsUseCase {
  constructor(
    @Inject('NoteRepository') private readonly noteRepository: NoteRepository,
    @Inject('NoteCollaboratorRepository')
    private readonly noteCollaboratorRepository: NoteCollaboratorRepository,
    @Inject('UserRepository') private readonly userRepository: UserRepository,
  ) {}

  async execute(
    noteId: string,
    requesterId: string,
  ): Promise<NoteCollaboratorListItem[]> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    // Allow owner and collaborators to view the list.
    if (note.ownerId !== requesterId) {
      const collaborator = await this.noteCollaboratorRepository.findByNoteAndUser(
        noteId,
        requesterId,
      );

      if (
        !collaborator ||
        (collaborator.role !== NotePermissionRole.EDITOR &&
          collaborator.role !== NotePermissionRole.VIEWER)
      ) {
        throw new Error('You do not have access to view collaborators');
      }
    }

    const owner = await this.userRepository.findById(note.ownerId);
    const ownerDisplayName = owner
      ? `${owner.firstName} ${owner.lastName}`.trim() || owner.email.getValue()
      : '';
    const ownerItem: NoteCollaboratorListItem | null = owner
      ? {
          userId: owner.id,
          email: owner.email.getValue(),
          displayName: ownerDisplayName,
          role: 'OWNER',
        }
      : null;

    const collaborators = await this.noteCollaboratorRepository.findByNoteId(noteId);
    const collaboratorItems = await Promise.all(
      collaborators.map(async (collaborator) => {
        // Safety: ignore any stale collaborator rows for the owner.
        if (collaborator.userId === note.ownerId) {
          return null;
        }

        const user = await this.userRepository.findById(collaborator.userId);
        if (!user) {
          return null;
        }

        const displayName = `${user.firstName} ${user.lastName}`.trim() || user.email.getValue();

        return {
          userId: user.id,
          email: user.email.getValue(),
          displayName,
          role: collaborator.role,
        } as NoteCollaboratorListItem;
      }),
    );

    const validCollaboratorItems = collaboratorItems.filter(
      (item): item is NoteCollaboratorListItem => item !== null,
    );

    return ownerItem
      ? [ownerItem, ...validCollaboratorItems]
      : validCollaboratorItems;
  }
}

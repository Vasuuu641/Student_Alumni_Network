import { Injectable, Inject } from '@nestjs/common';
import type { NoteRepository } from 'src/domain/repositories/note.repository';
import type { NoteCollaboratorRepository } from 'src/domain/repositories/note-collaborator.repository';
import type { UserRepository } from 'src/domain/repositories/user.repository';

export interface NoteCollaboratorListItem {
  userId: string;
  email: string;
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

    // Owner-only for collaborator management UI
    if (note.ownerId !== requesterId) {
      throw new Error('Only the note owner can list collaborators');
    }

    const owner = await this.userRepository.findById(note.ownerId);
    const ownerItem: NoteCollaboratorListItem | null = owner
      ? {
          userId: owner.id,
          email: owner.email.getValue(),
          role: 'OWNER',
        }
      : null;

    const collaborators = await this.noteCollaboratorRepository.findByNoteId(noteId);
    const collaboratorItems = await Promise.all(
      collaborators.map(async (collaborator) => {
        const user = await this.userRepository.findById(collaborator.userId);
        if (!user) {
          return null;
        }

        return {
          userId: user.id,
          email: user.email.getValue(),
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

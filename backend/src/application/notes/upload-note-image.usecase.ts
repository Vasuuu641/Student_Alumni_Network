// application/notes/upload-note-image.usecase.ts
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { NoteRepository } from 'src/domain/repositories/note.repository';
import type { NoteCollaboratorRepository } from 'src/domain/repositories/note-collaborator.repository';
import type { FileStorageService, FileUploadRequest } from 'src/domain/services/file-storage';
import { NOTE_IMAGE_UPLOAD_OPTIONS } from 'src/shared/constants/upload_limits';

@Injectable()
export class UploadNoteImageUseCase {
  constructor(
    @Inject('NoteRepository') private readonly noteRepository: NoteRepository,
    @Inject('NoteCollaboratorRepository') private readonly noteCollaboratorRepository: NoteCollaboratorRepository,
    @Inject('FileStorageService') private readonly fileStorageService: FileStorageService,
  ) {}

  async execute(noteId: string, actorId: string, file: FileUploadRequest): Promise<string> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const isOwner = note.ownerId === actorId;
    if (!isOwner) {
      const collaborator = await this.noteCollaboratorRepository.findByNoteAndUser(noteId, actorId);
      const isEditor = collaborator !== null && collaborator.role === 'EDITOR';
      if (!isEditor) {
        throw new ForbiddenException('User does not have permission to add images to this note');
      }
    }

    return this.fileStorageService.uploadFile('note', actorId, file, NOTE_IMAGE_UPLOAD_OPTIONS);
  }
}
//Restore a selected version of a note by creating a new headstate not deleting the history. 
//Preserves the audit trail and avoids destructive rollback
import { Injectable, Inject } from '@nestjs/common';
import { NoteVersion } from 'src/domain/entities/note-version.entity';
import type { NoteVersionRepository } from 'src/domain/repositories/note-version.repository';

@Injectable()
export class RestoreNoteVersionsUseCase {
  constructor(@Inject('NoteVersionRepository') private noteVersionRepository: NoteVersionRepository) {}

  async execute(noteId: string, versionNumber: number, actorId: string): Promise<NoteVersion> {
    const versionToRestore = await this.noteVersionRepository.findByNoteIdAndVersionNumber(noteId, versionNumber);
    if (!versionToRestore) {
      throw new Error("Note version not found");
    }

    // Create a new version with the content of the selected version to restore
    const latestVersion = await this.noteVersionRepository.findLatestByNoteId(noteId);
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
    const newVersion = new NoteVersion(
      crypto.randomUUID(),
      noteId,
      nextVersionNumber,
      versionToRestore.snapshotJson,
      actorId,
      new Date(),
    );

    return this.noteVersionRepository.create(newVersion);
  }
}
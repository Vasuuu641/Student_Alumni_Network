import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtStrategy } from '../../auth/jwt.strategy';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../domain/entities/authorized-user.entity';

// Use cases
import { CreateNoteUseCase } from '../../application/notes/create-note.usecase';
import { GetNoteUseCase } from '../../application/notes/get-note.usecase';
import { UpdateNoteUseCase } from '../../application/notes/update-note.usecase';
import { UpdateNoteMetadataUseCase } from '../../application/notes/update-note-metadata.usecase';
import { ShareNoteUseCase } from '../../application/notes/share-note.usecase';
import { UpdateSharePermissionUseCase } from '../../application/notes/update-share-permission.usecase';
import { RemoveCollaboratorUseCase } from '../../application/notes/remove-collaboration.usecase';
import { CreateNoteCheckpointUseCase } from '../../application/notes/create-note-checkpoint.usecase';
import { ListNoteVersionsUseCase } from '../../application/notes/list-note-versions.usecase';
import { RestoreNoteVersionsUseCase } from '../../application/notes/restore-note-versions.usecase';
import { ListUserNotesUseCase } from '../../application/notes/list-user-notes.usecase';
import {
  ListNoteCollaboratorsUseCase,
  type NoteCollaboratorListItem,
} from '../../application/notes/list-note-collaborators.usecase';
import type { NotesRealtimePublisher } from '../../domain/services/notes-realtime-publisher';

// DTOs
import { CreateNoteRequest } from './dto/create-note-request.dto';
import { UpdateNoteRequestDto } from './dto/update-note-request.dto';
import { ShareNoteRequest } from './dto/share-note-request.dto';
import { UpdateShareRoleRequestDto } from './dto/update-share-role-request.dto';

@Controller('notes')
@Roles(Role.STUDENT, Role.PROFESSOR)
export class NotesController {
  private readonly logger = new Logger(NotesController.name);

  private getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  constructor(
    private readonly createNoteUseCase: CreateNoteUseCase,
    private readonly getNoteUseCase: GetNoteUseCase,
    private readonly updateNoteUseCase: UpdateNoteUseCase,
    private readonly updateNoteMetadataUseCase: UpdateNoteMetadataUseCase,
    private readonly shareNoteUseCase: ShareNoteUseCase,
    private readonly updateSharePermissionUseCase: UpdateSharePermissionUseCase,
    private readonly removeCollaboratorUseCase: RemoveCollaboratorUseCase,
    private readonly createNoteCheckpointUseCase: CreateNoteCheckpointUseCase,
    private readonly listNoteVersionsUseCase: ListNoteVersionsUseCase,
    private readonly restoreNoteVersionsUseCase: RestoreNoteVersionsUseCase,
    private readonly listUserNotesUseCase: ListUserNotesUseCase,
    private readonly listNoteCollaboratorsUseCase: ListNoteCollaboratorsUseCase,
    @Inject('NotesRealtimePublisher')
    private readonly notesRealtimePublisher: NotesRealtimePublisher,
  ) {}

  /**
   * POST /notes
   * Create a new note for the authenticated user
   */
  @Post()
  @UseGuards(JwtStrategy, RolesGuard)
  async createNote(
    @Req() request: any,
    @Body() createNoteRequest: CreateNoteRequest,
  ): Promise<{ noteId: string }> {
    try {
      const userId = request.user.userId;
      const noteId = await this.createNoteUseCase.execute(
        userId,
        createNoteRequest.title,
      );
      return { noteId };
    } catch (error) {
      throw new HttpException(
        this.getErrorMessage(error, 'Failed to create note'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * GET /notes
   * List all notes for the authenticated user (owned + collaborated)
   */
  @Get()
  @UseGuards(JwtStrategy, RolesGuard)
  async listUserNotes(@Req() request: any) {
    try {
      const userId = request.user.userId;
      const notes = await this.listUserNotesUseCase.execute(userId);
      return { notes };
    } catch (error) {
      throw new HttpException(
        this.getErrorMessage(error, 'Failed to list notes'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * GET /notes/:id
   * Retrieve a specific note by ID (with access control)
   */
  @Get(':id')
  @UseGuards(JwtStrategy, RolesGuard)
  async getNote(
    @Req() request: any,
    @Param('id') noteId: string,
  ) {
    try {
      const userId = request.user.userId;
      const note = await this.getNoteUseCase.execute(noteId, userId);
      return { note };
    } catch (error) {
      throw new HttpException(
        this.getErrorMessage(error, 'Failed to get note'),
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * PATCH /notes/:id
   * Update note content (rich-text/JSON) and/or metadata (title/status)
   * Only accessible to owner or editors
   */
  @Patch(':id')
  @UseGuards(JwtStrategy, RolesGuard)
  async updateNote(
    @Req() request: any,
    @Param('id') noteId: string,
    @Body() updateNoteRequest: UpdateNoteRequestDto,
  ): Promise<{ success: boolean }> {
    try {
      const userId = request.user.userId;
      const debugPatch =
        process.env.DEBUG_NOTES_PATCH === '1' ||
        process.env.NODE_ENV !== 'production';

      if (debugPatch) {
        const contentJson = updateNoteRequest.content;
        const contentBytes =
          contentJson === undefined ? 0 : JSON.stringify(contentJson).length;
        this.logger.log(
          `PATCH /notes/${noteId} user=${userId} hasContent=${contentJson !== undefined} contentBytes=${contentBytes} hasTitle=${updateNoteRequest.title !== undefined} hasStatus=${updateNoteRequest.status !== undefined}`,
        );
      }
      
      // Update content if provided
      if (updateNoteRequest.content !== undefined) {
        await this.updateNoteUseCase.execute(
          noteId,
          userId,
          updateNoteRequest.content,
        );
      }

      // Update metadata if provided
      if (
        updateNoteRequest.title !== undefined ||
        updateNoteRequest.status !== undefined
      ) {
        await this.updateNoteMetadataUseCase.execute(
          noteId,
          userId,
          updateNoteRequest.title,
          updateNoteRequest.status,
        );
      }

      if (debugPatch) {
        this.logger.log(`PATCH /notes/${noteId} user=${userId} success=true`);
      }

      return { success: true };
    } catch (error) {
      if (
        process.env.DEBUG_NOTES_PATCH === '1' ||
        process.env.NODE_ENV !== 'production'
      ) {
        this.logger.warn(
          `PATCH /notes/${noteId} failed: ${this.getErrorMessage(error, 'unknown error')}`,
        );
      }
      throw new HttpException(
        this.getErrorMessage(error, 'Failed to update note'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /notes/:id/share
   * Share a note with another user
   * Only accessible to note owner
   */
  @Post(':id/share')
  @UseGuards(JwtStrategy, RolesGuard)
  async shareNote(
    @Req() request: any,
    @Param('id') noteId: string,
    @Body() shareNoteRequest: ShareNoteRequest,
  ): Promise<{ success: boolean }> {
    try {
      const ownerId = request.user.userId;
      await this.shareNoteUseCase.execute(
        noteId,
        ownerId,
        shareNoteRequest.collaboratorEmail,
        shareNoteRequest.role,
      );
      return { success: true };
    } catch (error) {
      throw new HttpException(
        this.getErrorMessage(error, 'Failed to share note'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * GET /notes/:id/share
   * List note collaborators for owner management UI
   * Only accessible to note owner
   */
  @Get(':id/share')
  @UseGuards(JwtStrategy, RolesGuard)
  async listCollaborators(
    @Req() request: any,
    @Param('id') noteId: string,
  ): Promise<{ collaborators: NoteCollaboratorListItem[] }> {
    try {
      const ownerId = request.user.userId;
      const collaborators = await this.listNoteCollaboratorsUseCase.execute(
        noteId,
        ownerId,
      );
      return { collaborators };
    } catch (error) {
      throw new HttpException(
        this.getErrorMessage(error, 'Failed to list collaborators'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * PATCH /notes/:id/share/:userId
   * Update collaborator's role (viewer -> editor or vice versa)
   * Only accessible to note owner
   */
  @Patch(':id/share/:userId')
  @UseGuards(JwtStrategy, RolesGuard)
  async updateSharePermission(
    @Req() request: any,
    @Param('id') noteId: string,
    @Param('userId') collaboratorIdentifier: string,
    @Body() updateShareRequest: UpdateShareRoleRequestDto,
  ): Promise<{ success: boolean }> {
    try {
      const ownerId = request.user.userId;
      await this.updateSharePermissionUseCase.execute(
        noteId,
        ownerId,
        collaboratorIdentifier !== 'placeholder-userid'
          ? collaboratorIdentifier
          : updateShareRequest.email,
        updateShareRequest.role,
      );
      return { success: true };
    } catch (error) {
      throw new HttpException(
        this.getErrorMessage(error, 'Failed to update share permission'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * DELETE /notes/:id/share/:userId
   * Remove a collaborator from the note
   * Only accessible to note owner
   */
  @Delete(':id/share/:userId')
  @UseGuards(JwtStrategy, RolesGuard)
  async removeCollaborator(
    @Req() request: any,
    @Param('id') noteId: string,
    @Param('userId') collaboratorIdentifier: string,
  ): Promise<{ success: boolean }> {
    try {
      const ownerId = request.user.userId;
      await this.removeCollaboratorUseCase.execute(
        noteId,
        ownerId,
        collaboratorIdentifier,
      );
      return { success: true };
    } catch (error) {
      throw new HttpException(
        this.getErrorMessage(error, 'Failed to remove collaborator'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /notes/:id/versions
   * Create a version checkpoint
   * Accessible to owner or editors
   */
  @Post(':id/versions')
  @UseGuards(JwtStrategy, RolesGuard)
  async createCheckpoint(
    @Req() request: any,
    @Param('id') noteId: string,
  ): Promise<{ success: boolean }> {
    try {
      const actorId = request.user.userId;
      await this.createNoteCheckpointUseCase.execute(noteId, actorId);

      // Broadcast checkpoint event to all connected collaborators in this note room.
      // If versions exist, expose the latest version number; otherwise emit 0.
      const latestVersion = await this.listNoteVersionsUseCase.execute(
        noteId,
        actorId,
        1,
        1,
      );
      const versionNumber = latestVersion.length > 0 ? latestVersion[0].versionNumber : 0;
      this.notesRealtimePublisher.broadcastCheckpointCreated(
        noteId,
        actorId,
        versionNumber,
      );

      return { success: true };
    } catch (error) {
      throw new HttpException(
        this.getErrorMessage(error, 'Failed to create checkpoint'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * GET /notes/:id/versions
   * List all version checkpoints for a note
   * Accessible to owner or collaborators
   */
  @Get(':id/versions')
  @UseGuards(JwtStrategy, RolesGuard)
  async listVersions(
    @Req() request: any,
    @Param('id') noteId: string,
  ) {
    try {
      const actorId = request.user.userId;
      const page = 1;
      const pageSize = 10;
      const versions = await this.listNoteVersionsUseCase.execute(
        noteId,
        actorId,
        page,
        pageSize,
      );
      return {
        versions: versions.map((version) => ({
          versionNumber: version.versionNumber,
          createdAt: version.createdAt,
          createdBy: version.authorId,
          snapshotJson: version.snapshotJson,
        })),
      };
    } catch (error) {
      throw new HttpException(
        this.getErrorMessage(error, 'Failed to list versions'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /notes/:id/restore/:versionNumber
   */
  @Post(':id/restore/:versionNumber')
  @UseGuards(JwtStrategy, RolesGuard)
  async restoreVersion(
    @Req() request: any,
    @Param('id') noteId: string,
    @Param('versionNumber') versionNumber: string,
  ): Promise<{ success: boolean }> {
    try {
      const userId = request.user.userId;
      const version = parseInt(versionNumber, 10);
      if (isNaN(version)) {
        throw new Error('Invalid version number');
      }

      // Restore the version — use case writes snapshot back onto note.content
      await this.restoreNoteVersionsUseCase.execute(noteId, version, userId);

      // Fetch the note now that content has been restored so we can
      // broadcast the actual restored content to all collaborators
      const restoredNote = await this.getNoteUseCase.execute(noteId, userId);

      // Broadcast to all collaborators so their editors re-seed
      // from the restored content without requiring a page refresh
      this.notesRealtimePublisher.broadcastVersionRestored(
        noteId,
        userId,
        restoredNote.content,
      );

      return { success: true };
    } catch (error) {
      throw new HttpException(
        this.getErrorMessage(error, 'Failed to restore version'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
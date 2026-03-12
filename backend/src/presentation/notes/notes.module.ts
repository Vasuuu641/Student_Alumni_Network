import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';

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

// Repositories
import { PrismaNoteRepository } from '../../infrastructure/repositories/prisma-note.repository';
import { PrismaNoteCollaboratorRepository } from '../../infrastructure/repositories/prisma-note.collaborator.repository';
import { PrismaNoteVersionRepository } from '../../infrastructure/repositories/prisma-note.version.repository';
import { PrismaNoteActivityRepository } from '../../infrastructure/repositories/prisma-note.activity.repository';
import { PrismaUserRepository } from '../../infrastructure/repositories/prisma-user.repository';

// Gateway
import { NotesGateway } from '../../infrastructure/websocket/notes.gateway';

// Modules
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotesController],
  providers: [
    // Gateway
    NotesGateway,

    // Use Cases
    CreateNoteUseCase,
    GetNoteUseCase,
    UpdateNoteUseCase,
    UpdateNoteMetadataUseCase,
    ShareNoteUseCase,
    UpdateSharePermissionUseCase,
    RemoveCollaboratorUseCase,
    CreateNoteCheckpointUseCase,
    ListNoteVersionsUseCase,
    RestoreNoteVersionsUseCase,
    ListUserNotesUseCase,

    // Repository Implementations
    PrismaNoteRepository,
    PrismaNoteCollaboratorRepository,
    PrismaNoteVersionRepository,
    PrismaNoteActivityRepository,
    PrismaUserRepository,

    // Provide implementations with interface names
    {
      provide: 'NoteRepository',
      useClass: PrismaNoteRepository,
    },
    {
      provide: 'NoteCollaboratorRepository',
      useClass: PrismaNoteCollaboratorRepository,
    },
    {
      provide: 'NoteVersionRepository',
      useClass: PrismaNoteVersionRepository,
    },
    {
      provide: 'NoteActivityRepository',
      useClass: PrismaNoteActivityRepository,
    },
    {
      provide: 'UserRepository',
      useClass: PrismaUserRepository,
    },
  ],
  exports: [
    CreateNoteUseCase,
    GetNoteUseCase,
    UpdateNoteUseCase,
    UpdateNoteMetadataUseCase,
    ShareNoteUseCase,
    UpdateSharePermissionUseCase,
    RemoveCollaboratorUseCase,
    CreateNoteCheckpointUseCase,
    ListNoteVersionsUseCase,
    RestoreNoteVersionsUseCase,
    ListUserNotesUseCase,
  ],
})
export class NotesModule {}

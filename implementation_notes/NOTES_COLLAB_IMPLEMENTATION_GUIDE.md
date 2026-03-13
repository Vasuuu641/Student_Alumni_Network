# Collaborative Notes Implementation Guide (Step-by-Step)

## Why this guide
Build a Google-Docs-like notes feature in phases so it works now (create/edit/share/versioning) and is ready for future AI topic linking with threads.

---

## Phase 0 — Project prep (Day 1)

### 0.1 Confirm scope for V1
Implement only:
- Rich-text collaborative notes
- Invite collaborators with `viewer` / `editor`
- Version checkpoints and restore
- Audit/activity log

Defer for later:
- AI suggestions while typing
- Auto-linking to threads

### 0.2 Clean up notes module placeholders
Current notes files are empty; start here:
- `backend/src/presentation/notes/notes.conroller.ts` (rename typo to `notes.controller.ts`)
- `backend/src/presentation/notes/notes.module.ts`
- `backend/src/application/notes/create-note.usecase.ts`
- `backend/src/application/notes/update-note.usecase.ts`
- `backend/src/application/notes/share-note.usecase.ts`
- `backend/src/application/notes/link-note.usecase.ts`

### 0.3 Decide editor stack
Recommended:
- Frontend editor: TipTap (ProseMirror)
- Collaboration engine: Yjs (CRDT)
- Realtime transport: WebSocket gateway in Nest
- DB: PostgreSQL (Prisma)

Reason: CRDT prevents merge conflicts and scales better than full-document overwrite.

---

## Phase 1 — Data model and migrations (Days 1–2)

Your current Prisma schema has user/profile/auth models only. Add notes models in:
- `backend/src/infrastructure/database/prisma/schema.prisma`

### 1.1 Add enums
- `NotePermissionRole`: `OWNER`, `EDITOR`, `VIEWER`
- `NoteStatus`: `ACTIVE`, `ARCHIVED`, `DELETED`
- `NoteLinkSource`: `MANUAL`, `AI`

### 1.2 Add tables/models
1. `Note`
   - `id`, `title`, `ownerId`, `status`, `createdAt`, `updatedAt`
2. `NoteCollaborator`
   - `noteId`, `userId`, `role`, timestamps
   - unique `(noteId, userId)`
3. `NoteVersion`
   - `id`, `noteId`, `versionNumber`, `snapshotJson`, `authorId`, `createdAt`
4. `NoteActivity`
   - `id`, `noteId`, `actorId`, `action`, `metadataJson`, `createdAt`
5. `NoteThreadLink` (for future thread integration)
   - `id`, `noteId`, `threadId`, `confidence`, `source`, `createdAt`
6. `NoteChunk` (AI-ready indexing placeholder)
   - `id`, `noteId`, `versionId`, `chunkText`, `chunkOrder`, `embedding` (nullable), `createdAt`

### 1.3 Add relations
- `User` ↔ `Note` as owner
- `User` ↔ `NoteCollaborator`
- `Note` ↔ versions/activity/chunks/thread-links

### 1.4 Migration checklist
- Run migration
- Regenerate Prisma client
- Verify indexes on:
  - `Note(ownerId, updatedAt)`
  - `NoteCollaborator(userId)`
  - `NoteVersion(noteId, versionNumber)`
  - `NoteThreadLink(noteId)`

Acceptance criteria:
- Migration applies successfully
- Prisma client builds
- Unique constraints enforce collaborator uniqueness and version ordering

---

## Phase 2 — Domain and repository contracts (Days 2–3)

### 2.1 Create domain entities/interfaces
Add under:
- `backend/src/domain/entities/`
- `backend/src/domain/repositories/`

Entities:
- `NoteEntity`
- `NoteCollaboratorEntity`
- `NoteVersionEntity`

Repository interfaces:
- `NotesRepository`
- `NoteVersionsRepository`
- `NoteCollaboratorsRepository`
- `NoteActivityRepository`

### 2.2 Add Prisma repository implementations
Add under:
- `backend/src/infrastructure/repositories/`

Implement methods for:
- create/get/update note
- share/update collaborator role/remove collaborator
- create checkpoint/list checkpoints/restore checkpoint
- write activity events

Acceptance criteria:
- All use cases depend on repository interfaces, not Prisma directly

---

## Phase 3 — Application use cases (Days 3–5)

Implement in:
- `backend/src/application/notes/`

### 3.1 Core use cases
1. `CreateNoteUseCase`
2. `GetNoteUseCase`
3. `UpdateNoteMetadataUseCase` (title/status only)
4. `ShareNoteUseCase`
5. `UpdateSharePermissionUseCase`
6. `RemoveCollaboratorUseCase`
7. `CreateNoteCheckpointUseCase`
8. `ListNoteVersionsUseCase`
9. `RestoreNoteVersionUseCase`
10. `ListUserNotesUseCase`

### 3.2 Permission policy in use case layer
Implement a policy helper:
- `requireViewer()`
- `requireEditor()`
- `requireOwner()`

Rules:
- `VIEWER`: read only
- `EDITOR`: content edits + checkpoint creation
- `OWNER`: sharing/ownership/archive/delete

### 3.3 Activity event writes
Every mutating action writes to `NoteActivity`.

Acceptance criteria:
- Unauthorized users cannot access/update/share notes
- All successful mutations create activity events

---

## Phase 4 — API + DTO + module wiring (Days 5–6)

### 4.1 Controller and module
Implement in:
- `backend/src/presentation/notes/notes.controller.ts`
- `backend/src/presentation/notes/notes.module.ts`

### 4.2 Endpoints (minimum)
- `POST /notes`
- `GET /notes`
- `GET /notes/:id`
- `PATCH /notes/:id`
- `POST /notes/:id/share`
- `PATCH /notes/:id/share/:userId`
- `DELETE /notes/:id/share/:userId`
- `POST /notes/:id/versions`
- `GET /notes/:id/versions`
- `POST /notes/:id/restore/:versionNumber`

### 4.3 DTOs and validation
Add under:
- `backend/src/presentation/notes/dto/`

DTOs:
- `create-note-request.dto.ts`
- `update-note-request.dto.ts`
- `share-note-request.dto.ts`
- `update-share-role-request.dto.ts`
- `create-checkpoint-request.dto.ts`

Validation examples:
- title length limits
- role enum validation
- UUID params

Acceptance criteria:
- API returns consistent response format
- Validation errors are explicit and stable

---

## Phase 5 — Realtime collaboration transport (Week 2)

### 5.1 Gateway
Add a notes gateway in websocket infrastructure:
- `backend/src/infrastructure/websocket/notes.gateway.ts`

### 5.2 Rooms and events
Room key: `notes:{noteId}`

Events:
- `notes:join`
- `notes:leave`
- `notes:awareness`
- `notes:crdt-update`
- `notes:checkpoint-created`

### 5.3 Server guard checks
On socket join:
- validate JWT
- verify note permission from DB
- only then join room

Acceptance criteria:
- Two users can edit concurrently without overwriting each other
- Viewer cannot emit edit updates

---

## Phase 6 — Frontend editor integration (Week 2)

### 6.1 Editor page
Build full-page editor screen with:
- note title bar
- collaborator presence avatars
- formatting toolbar
- version/checkpoint panel

### 6.2 Rich text features (V1)
- headings, paragraph
- bold/italic/underline
- lists, code block, quote
- links
- image embed (optional for V1)

### 6.3 Collaboration behaviors
- Presence cursors
- Live remote changes
- Optimistic local editing
- Auto-save checkpoints every N minutes (configurable)

Acceptance criteria:
- Editing feels near-real-time
- Formatting survives reload and re-open

---

## Phase 7 — Versioning and restore UX (Week 2)

### 7.1 Checkpoint strategy
Create checkpoints on:
- manual “Save Version” click
- major actions (share changes, restore)
- periodic autosave interval

### 7.2 Restore flow
- preview selected version metadata
- restore creates a new head version (do not hard delete newer history)

Acceptance criteria:
- Users can browse and restore versions safely

---

## Phase 8 — AI-ready thread-linking foundation (Week 3)

Do this now so AI can be added later with minimal refactor.

### 8.1 Add background job trigger points
On checkpoint created:
1. extract plain text from note snapshot
2. split into chunks (by heading/paragraph)
3. store in `NoteChunk`
4. enqueue embedding job (no-op allowed in V1)

### 8.2 Prepare thread linking contract
Keep `link-note.usecase.ts` as the future integration boundary:
- input: `noteId`, context window text
- output: ranked thread candidates with confidence

### 8.3 Add manual link API now
- `POST /notes/:id/thread-links` (manual link)
- `GET /notes/:id/thread-links`

Acceptance criteria:
- Notes can already store thread links even before AI is enabled

---

## Phase 9 — Security, reliability, and scale checks

### 9.1 Security
- Server-side permission check for every REST and socket action
- Sanitize rich-text HTML when rendering/exporting
- Rate limit mutation endpoints and socket emits

### 9.2 Reliability
- Add idempotency for share invite endpoint if possible
- Wrap critical writes in DB transactions (share + activity, restore + version)

### 9.3 Scale baseline
- Use pagination for notes list, versions list, activity list
- Add indexes before traffic
- Keep snapshot payload sizes bounded

---

## Phase 10 — Testing plan

### 10.1 Backend tests
Add tests under:
- `backend/test/notes/`

Minimum tests:
- create note
- share note and role update
- viewer cannot edit
- editor can checkpoint
- owner can restore
- unauthorized socket join blocked

### 10.2 Manual API test files
Create `.http` files similar to existing pattern:
- `backend/test/notes/create-note.http`
- `backend/test/notes/share-note.http`
- `backend/test/notes/checkpoint.http`
- `backend/test/notes/restore.http`

### 10.3 Frontend test scenarios
- concurrent edits from two accounts
- permission downgrade from editor -> viewer while session open
- network reconnect behavior

---

## Suggested implementation order (exact)

1. Prisma models + migration
2. Domain repository interfaces
3. Prisma repository implementations
4. Core use cases (`create`, `get`, `share`, `checkpoint`)
5. Notes controller + DTOs + module wiring
6. Version list + restore use cases
7. WebSocket collaboration gateway
8. Frontend editor integration
9. Activity/audit and pagination
10. Note chunk pipeline + manual thread linking

---

## Definition of Done (V1)

V1 is done when all are true:
- Users can create, open, edit, and share notes
- `viewer` and `editor` permissions are enforced in REST + sockets
- Multiple users can edit concurrently
- Versions/checkpoints can be created and restored
- Activity log records all write operations
- `NoteThreadLink` and `NoteChunk` foundations exist for future AI linking

---

## Practical tips to avoid rework

- Keep collaborative content representation editor-agnostic in backend (`snapshotJson`), so changing editor later is easier.
- Keep AI integration behind one application boundary (`link-note.usecase.ts`).
- Avoid embedding business rules in controllers; keep them in use cases.
- Add metrics early (active collaboration sessions, checkpoint count, restore count, permission-denied count).

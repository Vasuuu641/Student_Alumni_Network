# Study Groups Implementation Plan (Backend + WebSocket + Frontend)

## Why this guide
Build the **Study Groups** feature in the same style as Notes and Threads: clean domain contracts, Prisma persistence, JWT-protected REST APIs, and real-time room interactions over Socket.IO.

This plan is structured so you can ship a usable V1 quickly, then add advanced collaboration features without rework.

---

## Phase 0 — Scope, feature contract, and guardrails (Day 1)

### 0.1 Define V1 scope (must-have)
Implement:
- Create study group
- Discover/list groups with filters
- Join/leave group
- Membership roles (`OWNER`, `MODERATOR`, `MEMBER`)
- Group posts/messages (simple threaded feed inside group)
- Group events/sessions (schedule item with date/time/link/location)
- Realtime updates for membership + new messages + announcements

Defer to V2:
- Group file storage
- Automatic matching/recommendation engine
- Advanced moderation queue
- Attendance analytics
- Calendar sync (Google/Outlook)

### 0.2 Use existing project patterns
Follow architecture already used by notes/threads:
- `presentation/*` for controllers + DTOs
- `application/*` for use cases
- `domain/*` for entities/repository/service contracts
- `infrastructure/repositories/*` for Prisma implementations
- `infrastructure/websocket/*` for gateways

Current placeholders already exist:
- `backend/src/application/study-groups/form-group.usecase.ts`
- `backend/src/application/study-groups/join-group.usecase.ts`
- `backend/src/presentation/study-groups/study-groups.controller.ts`
- `backend/src/presentation/study-groups/study-groups.module.ts`

### 0.3 Decide business rules before coding
Lock these decisions first:
- Visibility modes: `PUBLIC`, `PRIVATE`
- Who can create groups: all authenticated users (`STUDENT`, `ALUMNI`, `PROFESSOR`, optionally `ADMIN`)
- Capacity model: optional `maxMembers`
- Private group join: invite only or join-request approval (for V1 choose one; recommended invite only)
- Cross-role groups: allowed (recommended)

Acceptance criteria:
- V1 boundaries documented in ticket/README notes
- No ambiguous policy left before schema design

---

## Phase 1 — Data model and Prisma migration (Days 1–2)

Update Prisma schema at:
- `backend/src/infrastructure/database/prisma/schema.prisma`

### 1.1 Add enums
- `StudyGroupVisibility`: `PUBLIC`, `PRIVATE`
- `StudyGroupStatus`: `ACTIVE`, `ARCHIVED`, `DELETED`
- `StudyGroupMemberRole`: `OWNER`, `MODERATOR`, `MEMBER`
- `StudyGroupJoinStatus`: `ACTIVE`, `LEFT`, `REMOVED`, `PENDING` (if using requests)
- `StudyGroupPostStatus`: `ACTIVE`, `EDITED`, `DELETED`

### 1.2 Add core models
1. `StudyGroup`
	- `id`, `name`, `description`, `visibility`, `status`, `topicTags`, `maxMembers`, `ownerId`, timestamps
	- denormalized counters: `memberCount`, `postCount`, `lastActivityAt`

2. `StudyGroupMember`
	- `groupId`, `userId`, `role`, `joinStatus`, timestamps
	- unique `(groupId, userId)`

3. `StudyGroupPost`
	- `id`, `groupId`, `authorId`, `content`, `status`, `createdAt`, `updatedAt`

4. `StudyGroupSession`
	- `id`, `groupId`, `title`, `description`, `startsAt`, `endsAt`, `mode` (`ONLINE`, `OFFLINE`, `HYBRID`), `meetingLink`, `location`, `createdBy`, timestamps

5. `StudyGroupInvite` (recommended even in V1)
	- `id`, `groupId`, `email` or `inviteeUserId`, `invitedBy`, `token`, `expiresAt`, `acceptedAt`

6. Optional now / mandatory later: `StudyGroupAuditEvent`
	- membership changes, role updates, removals, archive actions

### 1.3 Add indexes
Add indexes for expected query paths:
- `StudyGroup(status, visibility, lastActivityAt)`
- `StudyGroup(ownerId)`
- `StudyGroupMember(userId, joinStatus)`
- `StudyGroupPost(groupId, createdAt)`
- `StudyGroupSession(groupId, startsAt)`

### 1.4 Migration checklist
- [ ] Add enums/models/relations
- [ ] Run `prisma migrate dev --name add_study_groups_v1`
- [ ] Run `prisma generate`
- [ ] Validate constraints for duplicate memberships
- [ ] Seed sample groups for local testing

Acceptance criteria:
- Migration runs cleanly
- Prisma client compiles
- Basic select queries on groups/members/posts use indexes

---

## Phase 2 — Domain layer + repository contracts (Days 2–3)

### 2.1 Domain entities
Create under `backend/src/domain/entities/`:
- `study-group.entity.ts`
  - enums + `StudyGroup`, `StudyGroupMember`, `StudyGroupPost`, `StudyGroupSession`

### 2.2 Repository interfaces
Create under `backend/src/domain/repositories/`:
- `study-group.repository.ts`
- `study-group-member.repository.ts`
- `study-group-post.repository.ts`
- `study-group-session.repository.ts`
- optionally `study-group-invite.repository.ts`

Key methods to define:
- create/find/list/update archive for groups
- add/remove/update role for membership
- create/list/edit/delete posts
- create/list/update/delete sessions
- transactional helpers for count updates (`memberCount`, `postCount`, `lastActivityAt`)

Acceptance criteria:
- Application use cases depend only on contracts, not Prisma directly
- Interfaces support pagination and filtering from day one

---

## Phase 3 — Infrastructure repositories (Days 3–4)

Implement Prisma repositories in:
- `backend/src/infrastructure/repositories/prisma-study-group.repository.ts`
- `backend/src/infrastructure/repositories/prisma-study-group-member.repository.ts`
- `backend/src/infrastructure/repositories/prisma-study-group-post.repository.ts`
- `backend/src/infrastructure/repositories/prisma-study-group-session.repository.ts`

Implementation notes:
- Use Prisma transactions for join/leave + counters
- Keep all soft-delete semantics in repository filters (never expose deleted rows)
- Normalize sort modes: `recent`, `mostMembers`, `mostActive`

Acceptance criteria:
- Repository unit tests pass (or integration tests if unit test setup is not ready)
- Counters stay correct under concurrent joins/posts

---

## Phase 4 — Application use cases (Days 4–6)

## 4.1 Core use cases
Implement in `backend/src/application/study-groups/`:

Group lifecycle:
1. `FormGroupUseCase` (use placeholder file)
2. `GetGroupUseCase`
3. `ListGroupsUseCase`
4. `UpdateGroupUseCase`
5. `ArchiveGroupUseCase`

Membership:
6. `JoinGroupUseCase` (use placeholder file)
7. `LeaveGroupUseCase`
8. `UpdateMemberRoleUseCase`
9. `RemoveMemberUseCase`

Posts:
10. `CreateGroupPostUseCase`
11. `ListGroupPostsUseCase`
12. `EditGroupPostUseCase`
13. `DeleteGroupPostUseCase`

Sessions:
14. `CreateGroupSessionUseCase`
15. `ListGroupSessionsUseCase`
16. `UpdateGroupSessionUseCase`
17. `CancelGroupSessionUseCase`

### 4.2 Permission policy helpers
Add policy helper (similar to threads/notes policy style):
- `requireGroupViewer()`
- `requireGroupMember()`
- `requireGroupModerator()`
- `requireGroupOwner()`

Rules:
- `PUBLIC` group details can be read without membership (if authenticated)
- posting requires membership
- role changes/removals require moderator or owner
- archive/delete requires owner/admin

### 4.3 Idempotency and race safety
- Join should be idempotent (joining twice should not duplicate)
- Leave should handle already-left gracefully
- Role update should block self-demotion for sole owner

Acceptance criteria:
- All happy paths + permission failures covered
- Clear domain errors mapped to HTTP status codes

---

## Phase 5 — REST API, DTOs, module wiring (Days 6–7)

Implement in:
- `backend/src/presentation/study-groups/study-groups.controller.ts`
- `backend/src/presentation/study-groups/study-groups.module.ts`
- `backend/src/presentation/study-groups/dto/*`

### 5.1 Endpoint contract (V1)
Group CRUD:
- `POST /study-groups`
- `GET /study-groups`
- `GET /study-groups/:id`
- `PATCH /study-groups/:id`
- `PATCH /study-groups/:id/archive`

Membership:
- `POST /study-groups/:id/join`
- `POST /study-groups/:id/leave`
- `GET /study-groups/:id/members`
- `PATCH /study-groups/:id/members/:userId/role`
- `DELETE /study-groups/:id/members/:userId`

Posts:
- `POST /study-groups/:id/posts`
- `GET /study-groups/:id/posts`
- `PATCH /study-groups/:id/posts/:postId`
- `DELETE /study-groups/:id/posts/:postId`

Sessions:
- `POST /study-groups/:id/sessions`
- `GET /study-groups/:id/sessions`
- `PATCH /study-groups/:id/sessions/:sessionId`
- `DELETE /study-groups/:id/sessions/:sessionId`

### 5.2 DTO checklist
Add DTOs with `class-validator`:
- `create-study-group-request.dto.ts`
- `list-study-groups-query.dto.ts`
- `update-study-group-request.dto.ts`
- `create-group-post-request.dto.ts`
- `update-group-post-request.dto.ts`
- `create-group-session-request.dto.ts`
- `update-group-session-request.dto.ts`
- `update-group-member-role-request.dto.ts`

Validation examples:
- group name length and trim
- max tag count
- UUID params
- session time validation (`endsAt > startsAt`)

### 5.3 Module wiring
In `study-groups.module.ts`:
- import `PrismaModule` + `AuthModule`
- register use cases
- bind repository tokens
- register gateway + realtime publisher token

Acceptance criteria:
- Endpoints are JWT-protected
- API responses follow existing project style (`{ success: boolean }`, `{ data }`, etc.)

---

## Phase 6 — WebSocket realtime design (Week 2)

Create gateway:
- `backend/src/infrastructure/websocket/study-groups.gateway.ts`

Use namespace pattern consistent with threads:
- Namespace: `/study-groups`
- Room key: `study-groups:{groupId}`

### 6.1 Socket auth + membership checks
On connect:
- verify JWT via existing `TokenService`

On `study-groups:join-room`:
- verify user can view the group
- for private groups, require active membership

### 6.2 Event contract
Client -> server:
- `study-groups:join-room`
- `study-groups:leave-room`
- `study-groups:typing` (optional V1.1)

Server -> client:
- `study-groups:joined`
- `study-groups:presence`
- `study-groups:member-joined`
- `study-groups:member-left`
- `study-groups:member-role-updated`
- `study-groups:post-created`
- `study-groups:post-updated`
- `study-groups:post-deleted`
- `study-groups:session-created`
- `study-groups:session-updated`
- `study-groups:session-cancelled`

### 6.3 Realtime publisher abstraction
Add domain service contract:
- `backend/src/domain/services/study-groups-realtime-publisher.ts`

Inject in use cases that mutate posts/members/sessions so REST and WS stay decoupled.

Acceptance criteria:
- Multiple members in same room receive updates in near real-time
- Non-member cannot subscribe to private group room

---

## Phase 7 — Backend testing strategy (Week 2)

### 7.1 HTTP tests
Create under `backend/test/study-groups/`:
- `create-group.http`
- `join-leave-group.http`
- `group-posts.http`
- `group-sessions.http`
- `group-role-management.http`

### 7.2 WebSocket tests
Add script similar to notes/threads tests:
- `backend/test/study-groups/ws-study-groups-test.mjs`

Test scenarios:
- valid join + invalid join
- post broadcast to room members
- leave event
- session create broadcast

### 7.3 Failure-path tests
- private group unauthorized access
- non-moderator trying to remove member
- invalid session time range

Acceptance criteria:
- Deterministic test pass on local/dev DB
- No flaky WS tests across repeated runs

---

## Phase 8 — Frontend API and socket client layer (Week 2)

Implement API client file:
- `web/src/api/study-groups.api.ts`

Functions:
- `createStudyGroup()`
- `listStudyGroups()`
- `getStudyGroup()`
- `joinStudyGroup()` / `leaveStudyGroup()`
- post/session CRUD wrappers

Socket helper:
- `web/src/lib/studyGroupsSocket.ts`
  - `createStudyGroupsSocket(token)`
  - typed event listener wrappers

Acceptance criteria:
- API layer has stable TypeScript types
- Socket helper handles reconnect + room rejoin logic

---

## Phase 9 — Frontend screens and UX flow (Week 2–3)

### 9.1 Pages to add
Under `web/src/pages/`:
- `StudyGroupsPage.tsx` (discovery/listing)
- `StudyGroupDetailPage.tsx` (feed, members, sessions)
- optional `CreateStudyGroupPage.tsx`

### 9.2 Components to add
Under `web/src/components/study-groups/`:
- `GroupCard.tsx`
- `GroupFilters.tsx`
- `GroupJoinButton.tsx`
- `GroupMembersPanel.tsx`
- `GroupPostsFeed.tsx`
- `GroupPostComposer.tsx`
- `GroupSessionsPanel.tsx`
- `CreateSessionModal.tsx`

### 9.3 Router integration
Update routes in app router:
- `/study-groups`
- `/study-groups/:groupId`

Add dashboard shortcut button (same style as notes/threads).

### 9.4 Realtime UI behavior
- optimistic post create
- merge server broadcast updates by `id`
- live member count + presence indicator
- toasts for role changes and removals

Acceptance criteria:
- user can discover, join, post, and view upcoming sessions without reload
- UI remains consistent after reconnect

---

## Phase 10 — Security, moderation, and abuse controls (Week 3)

Backend hardening checklist:
- enforce payload length limits on post content
- sanitize text output if rendering rich content
- rate limit post creation and join attempts
- audit logs for role changes and removals
- prevent owner lockout (must always keep at least one owner)

Frontend safety:
- render user-generated content safely
- show role badges clearly to reduce privilege confusion

Acceptance criteria:
- no privilege escalation path through REST or WS
- audit trail exists for moderation-sensitive actions

---

## Phase 11 — Delivery plan and milestones

### Milestone A (Backend foundation)
- schema + repositories + core use cases + REST endpoints

### Milestone B (Realtime)
- gateway + publisher + WS tests

### Milestone C (Frontend functional)
- list/detail pages + API integration + basic realtime updates

### Milestone D (Polish)
- permission edge cases + UX cleanups + docs

Recommended merge strategy:
- PR1: schema + contracts
- PR2: repositories + use cases
- PR3: controller/module + tests
- PR4: gateway + realtime tests
- PR5: frontend pages + api/socket integration

---

## Suggested file checklist (quick reference)

Backend:
- `backend/src/domain/entities/study-group.entity.ts`
- `backend/src/domain/repositories/study-group.repository.ts`
- `backend/src/domain/repositories/study-group-member.repository.ts`
- `backend/src/domain/repositories/study-group-post.repository.ts`
- `backend/src/domain/repositories/study-group-session.repository.ts`
- `backend/src/domain/services/study-groups-realtime-publisher.ts`
- `backend/src/application/study-groups/*`
- `backend/src/presentation/study-groups/study-groups.controller.ts`
- `backend/src/presentation/study-groups/study-groups.module.ts`
- `backend/src/infrastructure/repositories/prisma-study-group*.ts`
- `backend/src/infrastructure/websocket/study-groups.gateway.ts`
- `backend/test/study-groups/*`

Frontend:
- `web/src/api/study-groups.api.ts`
- `web/src/lib/studyGroupsSocket.ts`
- `web/src/pages/StudyGroupsPage.tsx`
- `web/src/pages/StudyGroupDetailPage.tsx`
- `web/src/components/study-groups/*`
- app routing updates (`web/src/App.tsx`)

---

## Final implementation notes

1. Keep V1 text-only for group posts (fastest path).
2. Reuse threads/notes gateway conventions to avoid new realtime patterns.
3. Build strict permission checks in use cases first, then expose APIs.
4. Add denormalized counters from day one to keep list APIs fast.
5. Ship small increments with test artifacts (`.http` + WS test scripts) each phase.

If you want, the next step is I can generate the **exact Prisma schema block** for study groups and scaffold the `study-groups.module.ts` providers list to match your current dependency injection style.

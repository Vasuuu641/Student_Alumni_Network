# Student–Alumni Network – 12 Week Execution Plan
Timeline: Last Week of February → Mid–May  

---

# Week 1 – Architecture Lock & Database Finalization
(Feb 24 – Mar 2)

## Objectives
- Finalize Prisma schema:
  - User
  - Student
  - Alumni
  - Professor
  - Admin
  - AuthorizedUser (pre-approved university list)
- Add proper relations and indexes.
- Clean migration (reset if necessary).
- Verify Prisma repositories match domain repository interfaces.
- Refactor folder structure if anything is messy.
- Confirm Docker DB persistence using volumes.

## Deliverable
Stable database schema that will not require structural redesign later.

---

# Week 2 – Authentication Core (Scalable Design)
(Mar 3 – Mar 9)

## Objectives
- Create IdentityProvider abstraction in domain.
- Implement LocalAuthorizedListIdentityProvider.
- Implement:
  - RegisterUserUseCase
  - LoginUserUseCase
- Hash passwords with bcrypt.
- Implement JWT strategy.
- Add AuthGuard.
- Add email domain restriction (e.g. @university.hu).
- Implement AuthorizedUser table validation.

## Deliverable
Fully working authentication with:
- Role stored in JWT
- Secure password storage
- Admin-controlled onboarding

Authentication must be swappable later for Neptun integration.

---

# Week 3 – Role-Based Access & Admin System
(Mar 10 – Mar 16)

## Objectives
- Implement RoleGuard.
- Create role decorator.
- Secure endpoints by role.
- Build Admin endpoints:
  - Add authorized emails
  - Deactivate users
  - List pending registrations
- Add activation flag logic.

## Deliverable
Strict authorization system.
No endpoint should be accessible without correct role.

---

# Week 4 – User Profiles (All Roles)
(Mar 17 – Mar 23)

## Objectives
- Complete Student profile logic.
- Complete Alumni profile logic.
- Complete Professor profile logic.
- Ensure one-to-one relation enforcement.
- Prevent cross-role profile creation.
- Add update profile endpoints.
- Add validation DTOs.

## Deliverable
Fully functional user role system with structured profile data.

---

# Week 5 – Notes System
(Mar 24 – Mar 30)

## Objectives
- Implement:
  - Create note
  - Update note
  - Delete note
  - Share note
- Ownership checks.
- Pagination.
- Repository implementation.
- Domain logic separated from Prisma.

## Deliverable
Secure content feature.

---

# Week 6 – Threads & Q/A System
(Mar 31 – Apr 6)

## Objectives
- Create thread.
- Answer thread.
- Prevent duplicate answers.
- Add soft delete.
- Add role visibility checks.
- Prepare routing logic structure (even if AI not implemented yet).

## Deliverable
Functional academic discussion feature. Same logic for alumni career advice threads.

---

# Week 7 – Study Groups
(Apr 7 – Apr 13)

## Objectives
- Create study group.
- Join group.
- Capacity enforcement.
- Prevent duplicate membership.
- Simple matching logic.

## Deliverable
Basic collaboration feature.

---

# Week 8 – Real-Time Chat (WebSockets)
(Apr 14 – Apr 20)

## Objectives
- Implement ChatGateway.
- Authenticate WebSocket connections via JWT.
- Join room logic.
- Persist messages.
- Prevent cross-room data leakage.
- Add message retrieval API.

## Deliverable
Stable real-time messaging.

If WebSockets break, everything feels amateur.

---

# Week 9 – Alumni Mentorship + Feed Foundation
(Apr 21 – Apr 27)

## Objectives
- Implement mentor clustering logic.
- Add request/accept workflow.
- Implement basic Feed aggregation:
  - Threads
  - Notes
  - Group updates
- Pagination and sorting.

## Deliverable
Platform begins to feel like a real network.

---

# Week 10 – AI Integrations 
(Apr 28 – May 4)

## Objectives
- Integrate Cohere embeddings for:
  - Note similarity
  - Thread suggestion
- Keep AI inside infrastructure layer only.
- No domain pollution.
- Add fallback if AI fails.

## Deliverable
AI-powered features which use embeddings and semantic search to provide the user a personalized feed and enables linking between threads and notes

---

# Week 11 – Security, Testing, Hardening
(May 5 – May 11)

## Objectives
- Add unit tests for:
  - Auth
  - Notes
  - Threads
- Add integration tests.
- Validate:
  - JWT expiration
  - Role escalation protection
  - DTO validation
- Add rate limiting to login.
- Review database indexes.

## Deliverable
System that does not collapse under basic scrutiny.

---

# Week 12 – Finalization & Thesis Polish
(May 12 – May 18)

## Objectives
- Clean code.
- Remove dead files.
- Document:
  - Clean Architecture decisions
  - Authentication abstraction
  - Database design
  - AI integration reasoning
- Final Docker production config.
- Backup strategy.
- Prepare demo scenario.
- Prepare architecture diagram.

## Deliverable
Production-ready thesis system.

---

# Non-Negotiable Rules

1. No business logic inside controllers.
2. Domain layer must not import NestJS.
3. Infrastructure depends on domain only.
4. Authentication provider must be replaceable.
5. No redesign after Week 4.

---

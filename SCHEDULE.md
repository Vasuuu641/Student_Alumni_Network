# Student–Alumni Network – 12 Week Execution Plan
Timeline: Last Week of February → Mid–May

---

# Week 1 – Architecture Lock & Product Definition
(Feb 24 – Mar 2)

## Backend
- Finalize Prisma schema:
  - User
  - Student
  - Alumni
  - Professor
  - Admin
  - AuthorizedUser
- Add proper relations and indexes
- Run clean migration (reset if required)
- Ensure Prisma repositories match domain interfaces
- Confirm Docker database persistence using volumes

## Frontend
- Define MVP feature scope
- Define complete user flows:
  - Register
  - Login
  - Dashboard
  - Profile
  - Threads
  - Notes
  - Study Groups
  - Admin Panel
- Create screen inventory:
  - Web (React)
  - Mobile (React Native)
- Create low-fidelity wireframes
- Define base design system:
  - Color palette
  - Typography scale
  - Layout grid
  - Buttons
  - Form components

## Deliverable
Locked database schema + complete product structure definition.

---

# Week 2 – Authentication Core & UI Foundations
(Mar 3 – Mar 9)

## Backend
- Create IdentityProvider abstraction in domain
- Implement LocalAuthorizedListIdentityProvider
- Implement:
  - RegisterUserUseCase
  - LoginUserUseCase
- Hash passwords with bcrypt
- Implement JWT strategy
- Add AuthGuard
- Add email domain restriction (e.g. @university.hu)
- Validate AuthorizedUser table during registration

## Web (React)
- Initialize project
- Setup routing
- Setup base layout
- Create reusable form components
- Build Login screen
- Build Register screen
- Integrate authentication API
- Implement token storage strategy

## Mobile (React Native)
- Initialize Expo project
- Setup navigation
- Implement Login screen
- Implement Register screen
- Store JWT securely

## Deliverable
Working authentication on web and mobile.

Authentication must be swappable later for Neptun integration.

---

# Week 3 – Role-Based Access & Admin System
(Mar 10 – Mar 16)

## Backend
- Implement RoleGuard
- Create role decorator
- Secure endpoints by role
- Build Admin endpoints:
  - Add authorized emails
  - Deactivate users
  - List pending registrations
- Implement activation flag logic

## Web
- Implement dashboard layout with sidebar
- Implement role-based UI rendering
- Build Admin panel:
  - Authorized users list
  - Add authorized user form
  - Activation toggle

## Mobile
- Restrict navigation by role
- Optional: basic admin functionality

## Deliverable
Strict role enforcement across backend and frontend. No endpoint should be accessible without correct role.

---

# Week 4 – User Profiles (All Roles)
(Mar 17 – Mar 23)

## Backend
- Complete Student profile logic
- Complete Alumni profile logic
- Complete Professor profile logic
- Enforce one-to-one relations
- Prevent cross-role profile creation
- Add update profile endpoints
- Add validation DTOs

## Web
- Profile page
- Edit profile form
- Public profile view
- Role-specific rendering

## Mobile
- Profile view screen
- Edit profile screen

## Deliverable
Complete profile system for all roles. **No schema redesign after this week.**

---

# Week 5 – Notes System
(Mar 24 – Mar 30)

## Backend
- Create note
- Update note
- Delete note
- Share note
- Add ownership checks
- Add pagination
- Keep domain logic separated from Prisma

## Web
- Notes dashboard
- Create/edit modal
- Notes list with pagination
- Ownership indicators

## Mobile
- Create note
- View notes
- Basic edit and delete

## Deliverable
Secure content feature.

---

# Week 6 – Threads & Q/A System
(Mar 31 – Apr 6)

## Backend
- Create thread
- Answer thread
- Prevent duplicate answers
- Add soft delete
- Add role visibility checks
- Prepare routing logic structure (even if AI not implemented yet)

## Web
- Thread feed page
- Thread detail page
- Answer form
- Sorting and pagination

## Mobile
- Thread list
- Thread detail
- Answer submission

## Deliverable
Functional academic discussion feature. Same logic applies for alumni career advice threads.

---

# Week 7 – Study Groups
(Apr 7 – Apr 13)

## Backend
- Create study group
- Join group
- Enforce capacity
- Prevent duplicate membership
- Simple matching logic

## Web
- Group list
- Group detail page
- Join button

## Mobile
- View groups
- Join group

## Deliverable
Basic collaboration feature.

---

# Week 8 – Real-Time Chat (WebSockets)
(Apr 14 – Apr 20)

## Backend
- Implement ChatGateway
- Authenticate WebSocket connections via JWT
- Implement room logic
- Persist messages
- Prevent cross-room data leakage
- Add message retrieval API

## Web
- Chat UI
- Room list
- Live message updates
- Scroll management

## Mobile
- Basic chat interface
- Real-time message updates

## Deliverable
Stable real-time messaging. If WebSockets break, everything feels amateur.

---

# Week 9 – Alumni Mentorship & Feed Foundation
(Apr 21 – Apr 27)

## Backend
- Implement mentor request workflow
- Add request/accept logic
- Implement basic Feed aggregation:
  - Threads
  - Notes
  - Group updates
- Add pagination and sorting

## Web
- Feed UI
- Mentor request UI
- Notification indicator

## Mobile
- Feed screen
- Mentor request flow

## Deliverable
Platform begins to feel like a real network.

---

# Week 10 – AI Integrations
(Apr 28 – May 4)

## Backend
- Integrate Cohere embeddings for:
  - Note similarity
  - Thread suggestion
- Keep AI inside infrastructure layer only
- No domain pollution
- Add fallback if AI fails

## Web
- Suggested threads section
- Related notes component
- Personalized feed logic

## Mobile
- Suggested content blocks

## Deliverable
AI-powered features using embeddings and semantic search to provide a personalized feed and enable linking between threads and notes.

---

# Week 11 – Security, Testing & Hardening
(May 5 – May 11)

## Backend
- Add unit tests for:
  - Auth
  - Notes
  - Threads
- Add integration tests
- Validate:
  - JWT expiration
  - Role escalation protection
  - DTO validation
- Add rate limiting to login
- Review database indexes

## Frontend
- Responsive design audit
- Improve loading states
- Improve error handling
- Handle expired token flows
- Validate forbidden access behavior
- Refine mobile UI

## Deliverable
System that does not collapse under basic scrutiny.

---

# Week 12 – Finalization & Thesis Polish
(May 12 – May 18)

## Backend
- Clean codebase
- Remove dead files
- Document:
  - Clean Architecture decisions
  - Authentication abstraction
  - Database design
  - AI integration reasoning
- Final Docker production configuration
- Backup strategy
- Prepare architecture diagram

## Frontend
- Final UI polish
- Accessibility review
- Performance optimization
- Remove unused components
- Prepare demo walkthrough

## Deliverable
Production-ready thesis system.

---

# Non-Negotiable Rules

1. No business logic inside controllers.
2. Domain layer must not import NestJS.
3. Infrastructure depends on domain only.
4. Authentication provider must be replaceable.
5. No redesign after Week 4.
6. No frontend feature without backend support.
7. Every screen must include loading and error states.
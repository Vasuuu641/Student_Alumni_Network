# Student–Alumni Network – 12 Week Execution Plan
Timeline: Last Week of February → Mid–May

---

# Week 1 – Architecture Lock & Product Definition
(Feb 10 – Feb 13)

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
(Feb 14 - Feb 18)

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
(Feb 19 – Feb 24)

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

# Week 4 – User Profiles (All Roles) and Onboarding
(Feb 25 – March 10)

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

# Week 5 and 6 – Notes and Threads system
(Mar 11 – Mar 19)

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
Secure content feature.
Functional academic discussion feature. Same logic applies for alumni career advice threads.

---

# Week 7 – AI Integrations
(March 20 - March 26)

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

# Week 8 – Study Groups
(March 28 – March 31)

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

# Week 9 – Geo-Based Help Board
(April 1 - April 6)

## Backend
- Geo Resources (Static)
- Get all resources
- Get nearby resources (lat, lng, radius)
- Admin-managed only (study spaces, labs, housing)
- Geo Events (Dynamic)
- Create event
- Delete event
- Query nearby events
- Filter by:
* distance
* time (upcoming events)
* Core Logic
* Implement radius-based filtering (bounding box approach)
* Ensure proper indexing is used

## Web (React)
- Use a map library:
- Leaflet or
- Google Maps API
- Features
- Map-based UI (primary interface)
- Display:
* GeoResources (pinned locations)
* GeoEvents (user-created events)
* Click markers → show details
* Create event via map interaction
- Sidebar:
* List of nearby events/resources

## Mobile (React Native)
- Map screen
- Location permissions
- Nearby events/resources view
- Create event flow

---

# Week 10 – Alumni Mentorship & Feed Foundation
(Apr 7 - April 10)

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

# Week 11 – Security, Testing & Hardening
(April 11 - April 15)

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
(April 21 - April 27)

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

# POC Requirements
- users can create notes, share, edit - connected to cohere (call LLM locally)
- Doesn't need to be completely secure
- chat feature - how LLM will be used for mentor clustering

# MVP Requirements
- MVP is something that can be sold so by this point most features of the app should work well and users should be able to understand the app easily.

- The whole UI/UX doesn't need to be perfect but something that can work in a proper environment
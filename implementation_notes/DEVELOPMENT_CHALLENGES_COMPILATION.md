# UniBridge Development Challenges and Feature Complexity Summary

## Overview
This document consolidates the main development problems, tradeoffs, and implementation challenges that appeared across the project from the technical notes, implementation plans, and roadmap documents. It focuses on what was difficult to build, what had to be redesigned, and which features ended up being the most complex.

The project is not only a standard app build; it combines:
- role-based access control,
- AI-powered matching and semantic search,
- real-time collaboration,
- geographic data and map interactions,
- media/file handling,
- and multiple feature domains with different user flows.

Because of that, several features had to solve both product-level and engineering-level problems at the same time.

---

## 1. Authentication and Security

### Main challenges
- JWT-based authentication had to support both access tokens and refresh tokens.
- Refresh-token flow introduced security complexity because access tokens and refresh tokens needed separate validation rules and lifetimes.
- The system needed role-aware authorization across students, alumni, professors, and admins.
- WebSocket connections also needed authentication before establishing real-time channels.
- Rate limiting and abuse protection were necessary for AI-sensitive endpoints.

### Problems discussed in implementation notes
- Refresh token implementation required separate secrets, token type enforcement, and token rotation strategy.
- Access tokens were short-lived while refresh tokens were longer-lived, which created operational complexity for client code.
- Security rules had to be enforced at the application layer rather than only at the API layer.
- AI endpoints required cost protection because embedding generation can be expensive if abused.

### Complexity level
Medium to high.

### Why it matters
Authentication is foundational, but the project’s multi-role and AI-heavy environment made it more difficult than a basic login system.

---

## 2. User Profile and Onboarding

### Main challenges
- Profiles needed to support different fields depending on role.
- Alumni had to respect anonymous privacy behavior.
- The profile page had to show different information for self-view and public-view contexts.
- Profile data had to support onboarding, settings, and profile-card display without inconsistent models.

### Problems discussed in implementation notes
- The profile page required role-specific conditional rendering.
- Own profile could show private information, while other users had restricted public data.
- Alumni anonymous mode needed special handling so public views did not leak personal details.
- The backend needed separate public profile endpoints for viewing other users.

### Complexity level
Medium.

### Why it matters
The feature is visually straightforward, but the privacy and role logic make it more nuanced than it first appears.

---

## 3. File Storage and Profile Picture Uploads

### Main challenges
- File uploads needed to be reliable under failure conditions.
- The system had to avoid collisions, partial writes, and orphaned files.
- Uploads had to be validated against safe MIME types and extension handling.
- The update flow needed to avoid data loss when a database update failed.

### Problems discussed in implementation notes
- Before the fix, upload errors could leave the user without a profile picture after a delete operation.
- A failed database update could leave orphaned files in storage.
- Simultaneous uploads could create filename collisions.
- WebP was removed to tighten validation, and file writes were changed to use temp-file + atomic rename behavior.
- Delete logic needed to distinguish between normal missing files and actual filesystem errors.
- There was also discussion of future distributed locking and cleanup jobs for multi-server deployments.

### Complexity level
Medium to high.

### Why it matters
This looks like a small feature, but it becomes serious when reliability, transaction safety, and production behavior are considered.

---

## 4. Notes + AI Related Threads Panel

### Main challenges
- Real-time semantic suggestions needed to be triggered while a user was writing.
- The note editor had to detect content changes and send debounced requests.
- Similarity scores had to be robust enough to avoid noisy or irrelevant recommendations.
- The feature needed to work only when the LLM panel was open to avoid excessive load.
- The frontend and backend had to stay aligned around WebSocket events and payload structure.

### Problems discussed in implementation notes
- The implementation used a debounce timer to reduce request spamming while typing.
- Backend logic required a minimum content threshold before searching for similar threads.
- Results had to be limited by similarity threshold and result count.
- The backend had to validate access and permissions before returning related threads.
- Frontend integration needed a clean UX with loading, empty, and loaded states.

### Complexity level
High.

### Why it matters
This feature combines editor state, AI embedding search, real-time communication, and UX polish. It is one of the clearest examples of “smart feature complexity.”

---

## 5. Threads Feature (AI-Powered Discussion Panels)

### Main challenges
This feature was one of the most complex in the project.

- Two discussion panels were required: academic and alumni.
- Threads had to support creation, replies, nested structures, likes, status changes, and sorting.
- Real-time updates were required for new replies and notifications.
- The feature needed AI-powered deduplication and semantic similarity checks.
- Threads and notes had to be connectable for contextual discussion linking.
- The model had to support content moderation and soft-deletion concerns later.

### Problems discussed in implementation notes
- The implementation plan explicitly called out LLM deduplication as the core differentiator.
- It needed separate thread panels with different permission assumptions.
- There were decisions around flat replies versus nested replies, plus ranking and trending logic.
- The data model included thread embeddings, thread-note links, and thread similarity storage.
- The project explicitly noted that AI automatic linking was deferred, while manual linking was planned first.
- Future limitations included moderation, richer filtering, and full search indexing.

### Complexity level
Very high.

### Why it matters
The feature spans domain modeling, AI, API design, real-time updates, moderation, content management, and frontend discussions. It required architecture beyond a typical forum MVP.

---

## 6. Study Groups Feature

### Main challenges
- Study groups needed lifecycle operations: create, list, join, leave, archive, update.
- Permissions had to be modeled around owner, moderator, and member roles.
- Real-time behavior was expected for membership and message updates.
- The feature had to support both REST APIs and WebSocket interactions.
- AI-based recommendations required profile interest data and similarity scoring.
- Group events, posts, invites, and counters all had to be integrated coherently.

### Problems discussed in implementation notes
- The plan emphasized locking the business rules before coding: visibility mode, roles, capacity limits, and join rules.
- The repository and application layers needed transactional support to keep counters correct during concurrent joins or posts.
- The feature had to handle permission edges like self-demotion of the owner or duplicate membership attempts.
- AI recommendation logic depended on user profile interests and group tags, which created a requirement for profile completeness.
- Recommendation requests had to return a graceful error when user interests were missing.

### Complexity level
High.

### Why it matters
Study groups combine membership logic, collaboration flows, stateful permissions, event logic, and recommendation models in a way that is significantly more complex than a simple chat room.

---

## 7. Geo Help Board Feature

### Main challenges
- The feature had to work across web and mobile clients with a shared backend contract.
- Browser geolocation and map rendering behavior are not fully consistent across environments.
- The product required a map-first UX while the backend simply exposed normalized geo results.
- There were constraints around nearby radius validation and list pagination.
- The feature had to support moderation and review status as well as creation and popularity tracking.

### Problems discussed in implementation notes
- The backend intentionally normalized geo inputs to reduce frontend complexity.
- The API had to accept explicit coordinates instead of depending on client geolocation internals.
- Radius limits were constrained to a safe range.
- The frontend design involved location banners, map markers, tabs, and resource cards, which required a more elaborate UI than a simple list page.
- The backend already supported nearby and popular endpoints, but additional metadata fields such as occupancy, amenities, and operating hours were identified as likely necessary for polished UX.
- There was also discussion of future improvements like search-by-text, detail endpoints, and viewport-based querying.

### Complexity level
High.

### Why it matters
This feature mixes geospatial behavior, product design, moderation workflows, and location-permission management. It is not just a map widget; it is a full domain feature with backend and frontend coordination.

---

## 8. Personalized Notifications and Feed Intelligence

### Main challenges
- Personalized recommendations need user behavior, interests, and context.
- AI ranking had to balance relevance with privacy boundaries.
- Embedding-based feed logic can become expensive at scale.
- The feature had to be careful not to leak one user’s data into another user’s recommendations or results.

### Problems discussed in implementation notes
- The project explicitly mentioned that AI matching and feed personalization needed privacy-aware scoping.
- Cost control was a major concern because embeddings are expensive to generate.
- The platform uses this logic to connect notes, threads, groups, and feed content.

### Complexity level
Medium to high.

### Why it matters
This feature is conceptually valuable, but it is technically expensive and sensitive because it combines profiling, ranking, and recommendation logic.

---

## 9. Admin and Moderation Workflows

### Main challenges
- The project includes moderation and review states in several features.
- Review operations require audit metadata, status transitions, and permissions.
- Moderation logic often crosses feature boundaries rather than being isolated to one module.

### Problems discussed in implementation notes
- Geo help board backend had support for `PENDING`, `VERIFIED`, and `REJECTED` review states.
- Review metadata such as reviewer ID and timestamp was necessary.
- Threads and group features also discussed future moderation queues and soft-delete semantics.

### Complexity level
Medium to high.

### Why it matters
Moderation is often easier to overlook in planning, but it introduces operational rules, auditability, and permission enforcement that complicate every feature domain.

---

## Most Complex Features Ranked

### 1. Threads Feature
Most complex because it combines:
- AI semantic deduplication,
- multi-panel permission rules,
- discussion-model design,
- replies and voting,
- real-time updates,
- content linking to notes,
- and future moderation needs.

### 2. Study Groups Feature
Very difficult because it merges:
- role-based membership logic,
- group lifecycle management,
- message/session models,
- real-time collaboration,
- and AI recommendation scoring.

### 3. Notes + LLM Related Threads Integration
Complex due to:
- live editor event handling,
- embedding search,
- WebSocket communication,
- threshold tuning,
- and user experience optimization.

### 4. Geo Help Board
Difficult because of:
- geo data logic,
- map UX expectations,
- location permissions,
- moderation tied to resource review, and
- backend/frontend contract complexity.

### 5. File Storage / Profile Photo Uploads
Not the largest feature, but operationally tricky because it is built around:
- consistency,
- rollback reliability,
- atomic writes,
- collision prevention,
- and failure behavior.

### 6. Authentication & Authorization
Critical but foundational. It was more complex than a basic login flow because it had to cover multi-role routing, refresh tokens, secure WebSocket use, and AI cost protections.

---

## Overall Conclusion
The project’s most difficult development work was not in simple CRUD screens. The hardest features were the ones combining domain logic with AI, permissions, and real-time collaboration. The standout examples were:
- Threads
- Study Groups
- Notes LLM integration
- Geo Help Board

These features required the project to solve not only product behavior but also architectural concerns such as:
- event-driven design,
- semantic search,
- privacy-aware personalization,
- permission modeling,
- and operational reliability under failure conditions.

### Permission modeling as an architectural concern
Permission modeling became an architectural issue because access could not be treated as a simple role check at the UI layer. The backend had to define who could see, edit, or manage each resource, and those rules had to stay consistent across REST endpoints, realtime events, and frontend views.

Examples of the problems that forced fixes:
- Notes needed explicit owner/editor/viewer roles, so I had to model collaborators directly instead of assuming the note owner was the only meaningful permission boundary. That change made sharing, editing, and read-only access predictable.
- Study groups needed owner/moderator/member roles plus duplicate-membership protection and self-demotion rules. I had to enforce unique membership records and transactional membership updates so role changes and joins/leaves could not corrupt the group state.
- Threads and related content had to validate access before returning linked discussion data. I had to move permission checks into the backend service layer so the frontend only received data the current user was actually allowed to see.
- Geo help board and moderation flows needed different visibility rules for public users, submitters, and reviewers. I had to separate public-facing results from review-state metadata so pending or restricted items did not leak into the wrong view.

In short, the project’s complexity is driven less by page count and more by how many advanced systems had to be integrated into each feature.

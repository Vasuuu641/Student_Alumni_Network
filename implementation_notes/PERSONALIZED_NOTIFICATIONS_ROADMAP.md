# Personalized Notifications Roadmap

## Goal
Build notifications that are shown only to users who are likely to care about the event. This is not a broadcast notification system. The app should generate and deliver notifications from personal-interest signals such as:
- threads a user opened or actively participates in,
- topics and categories a user repeatedly engages with,
- geo-board categories and places a user frequently views, saves, or visits,
- direct interactions that indicate a strong preference signal.

The first implementation should focus on backend + web. Mobile can reuse the same backend contract later.

---

## Product Principle
The notification system should answer two questions before it delivers anything:
1. Is this event relevant enough to this specific user?
2. Is this a notification the user would reasonably expect based on past behavior?

If the answer to either is no, the event should be stored as a signal but not surfaced as a notification.

## Will This Use AI?
Yes, but only in a strict, limited way. The notification system should not let AI decide everything. It should use AI only as a helper on top of deterministic rules.

Recommended limit:
- rules decide whether an event is even eligible,
- AI ranks or refines only the small eligible set,
- AI never replaces mute, threshold, duplicate, or privacy checks,
- AI must have a fallback path if it is slow or unavailable.

Good AI uses:
- semantic similarity between a user’s interests and a new thread or geo recommendation,
- topic clustering for better category matching,
- final ranking among already-filtered candidates,
- summarizing why a notification is relevant.

Bad AI uses:
- deciding whether every event in the app should become a notification,
- scanning all activity continuously with no cap,
- overriding explicit user preferences,
- creating notifications without a deterministic eligibility check first.

Practical guardrails:
- cap AI evaluation to the top N eligible candidates per event,
- set a latency budget for AI scoring,
- cache repeated similarity results,
- disable AI per module if quality drops,
- keep manual threshold tuning available.

That means the system should work without AI if needed, but when AI is enabled it should only operate inside a narrow, measurable boundary.

---

## What Counts as a Personal-Interest Signal
Use multiple weak signals instead of one hard rule.

### Strong signals
- User explicitly follows a thread, place, or topic.
- User participates in a thread by posting, replying, liking, or reopening it.
- User saves/bookmarks a geo spot, place, or thread.

### Medium signals
- User opens the same thread repeatedly.
- User spends time on a thread, geo spot, or category page.
- User frequently interacts with one category such as shopping, academic help, housing, internships, etc.

### Weak signals
- Similar content appears in a category the user often engages with.
- A geo-board recommendation matches a user’s habitual browsing pattern.
- A thread receives active replies in a topic cluster the user often reads.

The first version should work with rules and scoring. ML can come later if the product needs it.

---

## Phase 1: Backend Foundation

### 1.1 Create a notification domain
Add a dedicated notifications model instead of piggybacking on threads or geo-board tables.

Core concepts:
- `Notification`: the actual user-facing item.
- `NotificationCandidate`: an internal event that may become a notification.
- `UserInterestProfile`: lightweight per-user preference data.
- `UserInterestSignal`: raw behavior events used for scoring.

Suggested fields:
- notification id, user id, type, title, body, entity type, entity id, score, read state, created at
- signal type, signal strength, source module, source entity, created at
- user-topic/category weights, last interacted at, decay window

### 1.2 Capture events from the app
Emit structured events from places that already know user behavior:
- thread open, thread reply, thread like, thread follow
- geo spot view, geo spot save, geo spot visit, geo category browse
- search result click, recommendation click, active discussion revisit

These events should be collected centrally, not handled ad hoc in each feature module.

### 1.3 Add an interest-scoring service
Create a scoring layer that turns raw events into a relevance score.

Initial scoring approach:
- explicit follow/save = high score
- repeated thread opens or spot views = medium score
- recent activity = higher than old activity
- negative feedback, mute, hide, or dismiss = score reduction

The scoring service should output a normalized score such as $0$ to $1$ and a reason code.

### 1.4 Add notification eligibility rules
Only create a notification if all of these are true:
- the score is above threshold,
- the user has not muted that topic or entity,
- the notification is not a duplicate,
- the event is recent enough to matter,
- the user is not the actor who caused the event unless the event type allows self-notifications.

### 1.5 Add delivery channels
Backend should support three delivery modes:
- in-app notification inbox,
- websocket push for live web updates,
- optional email/push later.

For now, the most important output is the in-app inbox and live web badge updates.

---

## Phase 2: Web App Experience

### 2.1 Notification center
Add a notification bell in the web header that shows:
- unread count,
- recent personalized items,
- a filter by type or source module,
- a read/unread state,
- a quick link back to the source thread, geo spot, or recommendation.

### 2.2 Notification cards
Each notification should explain why it appeared.
Examples:
- “A thread you follow is getting active replies.”
- “A shopping place similar to ones you view often was recommended near you.”
- “A discussion in alumni threads matches topics you revisit frequently.”

This explanation matters because the system is intentionally personalized and should feel understandable, not creepy.

### 2.3 Live updates
Use websocket delivery for immediate badge increments and toast alerts while the user is active.
Use the inbox as the source of truth so nothing is lost when the tab is closed.

### 2.4 Preference controls
Give users control over personalization.

Minimum controls:
- mute a thread or place,
- hide a category,
- turn off a notification type,
- reset interest preferences.

Without controls, the system will quickly feel noisy.

### 2.5 Web implementation order
1. Add UI shell for inbox and unread count.
2. Add API client methods for list/read/dismiss/mute.
3. Wire websocket updates into the header badge.
4. Add notification detail routing back into threads and geo-board pages.
5. Add user preference controls.

---

## Phase 3: Backend Event Sources by Module

### Threads
Trigger notifications when:
- a followed or frequently viewed thread gets a new reply,
- an active thread receives a burst of discussion,
- a new thread closely matches a user’s interest profile,
- a user’s own thread becomes active again.

Important: do not notify every participant for every reply. Rank recipients by relevance and suppress low-score users.

### Geo help board
Trigger notifications when:
- a new spot appears in a category the user often browses,
- a new recommended place matches the user’s observed habits,
- a saved or visited place gets new activity,
- a nearby place becomes relevant based on the user’s established interests.

Important: geo notifications should be based on category affinity and repeated behavior, not just distance.

### Notes, study groups, alumni, and feed
Later, the same system can ingest:
- note collaboration activity,
- study group invites or updates,
- alumni post activity,
- feed items that match the user’s engaged topics.

---

## Phase 4: Data Model and APIs

### Core API surface
Suggested endpoints:
- `GET /notifications`
- `GET /notifications/unread-count`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`
- `PATCH /notifications/:id/dismiss`
- `POST /notifications/:id/mute-source`
- `GET /notifications/preferences`
- `PATCH /notifications/preferences`

### Internal services
Suggested backend modules:
- event ingestion service
- interest scoring service
- notification generation service
- deduplication service
- preference service
- websocket delivery gateway

### Deduplication rules
Prevent repeated noise by collapsing equivalent events.
Examples:
- multiple replies in the same thread within a short window become one notification,
- repeated recommendations for the same geo spot collapse into one item,
- a dismissed item should not reappear immediately unless a truly new signal occurs.

---

## Phase 5: Ranking Strategy

Start with rules, then evolve.

### V1 ranking
Use a weighted score with time decay:
- explicit engagement weight
- category affinity weight
- recency weight
- conversation velocity weight
- user preference override weight

### V2 ranking
Add more context:
- content embeddings for topic similarity,
- collaborative filtering for users with similar behavior,
- hidden negative signals such as fast dismissals,
- per-module tuning so threads and geo-board can rank differently.

### V3 ranking
Consider offline evaluation:
- precision of delivered notifications,
- open rate,
- dismissal rate,
- mute rate,
- return-to-source click rate.

---

## Phase 6: Web Delivery UX

The web app should treat notifications as a lightweight inbox with live toasts, not as a heavy messaging center.

Recommended UX rules:
- use toasts only for recent, high-confidence events,
- keep all items in an inbox,
- show why each item was recommended,
- support quick mute and dismiss actions,
- avoid flooding the user when a thread becomes active.

If a source gets very active, batch updates into one summary notification rather than many separate ones.

---

## Phase 7: Mobile Later

Do not build mobile-specific logic first.

When mobile starts, it should reuse the same backend contracts and same notification identity model.
Mobile-specific work will mostly be presentation and delivery:
- push notification integration,
- mobile inbox UI,
- deep links into threads or geo spots,
- background sync for unread counts.

The scoring and eligibility logic should stay shared.

---

## Recommended Build Order
1. Define the notification data model and backend API contract.
2. Add centralized event capture for threads and geo-board first.
3. Build user interest profiles from behavior signals.
4. Add scoring and deduplication.
5. Deliver in-app inbox + websocket updates in web.
6. Add mute, dismiss, and preference controls.
7. Expand to notes, study groups, alumni, and feed.
8. Reuse the same system for mobile push later.

---

## Risks To Watch
- Too many notifications if the threshold is too low.
- Creepy personalization if reasons are not shown clearly.
- Duplicate notifications if event deduplication is weak.
- Hard-to-maintain feature-specific logic if each module invents its own notification rules.
- False positives if interest profiling ignores negative feedback.

---

## Success Criteria
The feature is healthy if:
- users see fewer but more relevant notifications,
- thread and geo notifications are clearly tied to personal behavior,
- unread counts stay accurate across sessions,
- users can mute or dismiss noisy sources,
- web and mobile can consume the same backend contract later.

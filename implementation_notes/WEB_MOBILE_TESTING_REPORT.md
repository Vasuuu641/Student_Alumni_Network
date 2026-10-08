# UniBridge Web and Mobile Testing Report

## Purpose
This document summarizes how the product was tested across web and mobile clients, including manual validation, WebSocket checks, AI-module verification, and automated test execution.

## Test Scope
The testing process covered:
- Web client behavior and backend API integration
- Real-time behavior over WebSockets
- AI-related features (similarity, recommendations, scoring)
- Mobile app behavior in Expo and on a physical device
- Backend automated tests that support both web and mobile correctness

## 1. Web Testing Approach

### 1.1 REST API client workflow
For API-level validation, I used REST request collections to execute endpoint-by-endpoint checks before and during frontend integration.

Key request collections used include:
- backend/test/auth/refresh-token.http
- backend/test/notes/notes-crud.http
- backend/test/threads/thread.http
- backend/test/threads/thread-replies.http
- backend/test/study-groups/study-groups.http
- backend/test/geo-help-board/geo-help-board.http
- backend/test/admin/*.http
- backend/test/student/*.http
- backend/test/alumni/*.http
- backend/test/professor/*.http

What this validated:
- Auth flows (login, token refresh, role behavior)
- CRUD behavior and validation errors
- Permission and role constraints
- Regression checks after backend changes

### 1.2 Feature-by-feature manual debugging on web
After API checks, each feature was manually tested in the web UI to validate real user behavior and to debug integration issues.

Manual checks included:
- Happy-path flows for each feature area
- Error and empty-state behavior
- Permission-driven UI differences by role
- Data consistency after create/edit/delete actions
- Interaction issues between UI state and backend responses

### 1.3 WebSocket behavior testing for web features
Real-time flows were tested using dedicated socket scripts and feature interaction checks.

Main WebSocket tests executed:
- Notes collaboration/socket flow:
  - backend/test/notes/ws-notes-test.mjs
  - backend/test/notes/ws-notes-related-threads-test.mjs
- Threads real-time events and interaction smoke tests:
  - backend/test/threads/ws-threads-test.mjs
  - backend/test/threads/ws-threads-similarity-search-test.mjs
- Study groups socket room and event tests:
  - backend/test/study-groups/ws-study-groups-test.mjs

What this validated:
- JWT-authenticated socket connections
- Room join/leave lifecycle
- Broadcast correctness to intended users/rooms
- Event payload integrity
- Real-time permission boundaries

## 2. AI Module Testing and Effectiveness Checks
AI behavior was validated with both automated tests and manual smoke scenarios to confirm relevance and practical usefulness.

### 2.1 Automated AI-related test coverage
Automated tests for AI-adjacent behavior include:
- Mentor clustering and relevance behavior:
  - backend/src/infrastructure/ai/cohere/mentor-clustering.service.spec.ts
- Notification scoring and eligibility rules:
  - backend/src/infrastructure/services/notification-eligibility.service.spec.ts
  - backend/src/infrastructure/services/personalized-notification-fanout.service.spec.ts
  - backend/src/infrastructure/queue/personalized-notification-worker.service.spec.ts
- Notification eligibility e2e-style validation:
  - backend/test/notifications/notifications.e2e-spec.ts

### 2.2 Manual effectiveness checks
Manual AI checks were run through socket smoke tests and realistic prompts/content:
- Thread similarity tests for related, unrelated, short, and near-duplicate inputs
- Notes related-threads checks for low-signal versus relevant note content
- Recommendation/eligibility behavior checks with score thresholds and muted-source constraints

Effectiveness criteria used during validation:
- Relevant queries should return high-similarity, context-appropriate results
- Unrelated or too-short inputs should return no or minimal noise
- Threshold and guardrails should prevent spammy/irrelevant outputs

## 3. Mobile Testing Approach

### 3.1 Expo-first testing phase
Initial mobile validation was done in Expo to iterate quickly on navigation, API integration, and UI behavior.

This phase focused on:
- Fast feedback during UI and feature integration
- Verifying authentication/session flows
- Basic API request/response behavior
- Early detection of state and rendering issues

### 3.2 Physical device testing over USB
After Expo-level validation, testing moved to direct physical-device verification via USB connection.

Why this step was important:
- Confirms behavior in a real mobile runtime and network context
- Catches device-specific issues not always obvious in emulator/simulator flows
- Validates camera/location/permissions and real interaction performance

Physical-device checks included:
- End-to-end login and authenticated navigation
- Real API + socket interactions from phone to backend
- Geo and media-adjacent flows where device context matters
- UX sanity checks for responsiveness and stability

## 4. Automated Tests Performed

### 4.1 Core automated test commands
Primary backend automation commands used:
- npm run test
- npm run test:cov
- npm run test:e2e
- npm run test:ws:notes
- npm run test:ws:threads
- npm run test:ws:similarity
- npm run test:ws:related-threads
- npm run test:ws:study-groups
- npm run test:study-groups:v2
- npm run test:notifications:gateway
- npm run test:notifications:spec

### 4.2 Representative automated suites
Examples of automated suites that were used:
- Unit tests for services/controllers and AI-related logic in backend/src/**/*.spec.ts
- API e2e tests such as backend/test/app.e2e-spec.ts and backend/test/geo-help-board/geo-help-board.e2e-spec.ts
- Hybrid REST + WebSocket integration flow in backend/test/study-groups/study-groups-v2.e2e.mjs

### 4.3 Current automation distribution
Current automated coverage is backend-heavy (API, services, socket behavior, AI logic). At the time of this report:
- Backend has established automated tests
- Web does not yet have a dedicated frontend automated runner configured in package scripts
- Mobile does not yet have a dedicated frontend automated runner configured in package scripts

## 5. Outcome Summary
The testing strategy used a layered approach:
- API-first validation with REST client collections
- Manual end-to-end feature debugging in web
- Dedicated real-time socket tests
- AI quality checks with both automated and manual scenarios
- Mobile verification in Expo, followed by physical phone testing over USB

This combination provided practical confidence in correctness, realtime behavior, and AI usefulness while the product evolved quickly.


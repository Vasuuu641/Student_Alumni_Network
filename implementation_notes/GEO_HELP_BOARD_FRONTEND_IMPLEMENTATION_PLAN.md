# Geo Help Board Frontend Implementation Plan

## Goal
Build the web frontend for the geo help board feature, presented in the UI as a campus resources experience. The page should match the attached design direction: a map-first resource browser with a location banner, quick filters, search, category tabs, resource cards, and resource status badges.

The backend already provides the core geo-help-board API, so the frontend should be implemented against the current contract first, then extended only where the screenshot requires richer metadata.

---

## Product direction
The UI should feel like a campus utility, not a generic map app.

Visual structure from the screenshots:
- top navigation consistent with the rest of the web app
- page title area with a short explanatory subtitle
- location banner showing the user’s current campus/location
- map panel with a legend, markers, and zoom controls
- tabs for switching between nearby resources and housing options
- search bar with category chips
- card grid listing individual resources with occupancy and distance

The page should be responsive, but the desktop layout is the primary target for the first implementation pass.

---

## Location and map strategy
Use two different layers here:

- browser geolocation for the user's current position, via `navigator.geolocation`
- a map rendering provider for the visual map, markers, and search/geocoding experience

Recommended approach for V1:

- use browser geolocation when the user allows it
- fall back to a saved campus default for Pecs, Hungary when geolocation is unavailable or denied
- keep the backend centered on latitude/longitude plus city, so the frontend can work across campuses

For the visual map, Google Maps API is a valid choice, but it is not the only one. If you want the quickest, most controllable implementation, a lighter stack such as Leaflet with OpenStreetMap tiles is often simpler and cheaper. If the product needs places autocomplete, rich place details, or Google-native branding, then Google Maps JavaScript API is the better fit.

For this feature, the important distinction is:

- geolocation tells you where the user is
- the map API draws the map and markers

---

## Current backend coverage
The backend already supports these frontend needs:

- `GET /geo-help-board/spots/nearby` with latitude, longitude, radius, city, category, limit, and page
- `GET /geo-help-board/spots/popular` with city, category, limit, and page
- `POST /geo-help-board/spots` for student-created resources
- `POST /geo-help-board/spots/:spotId/visit` for popularity tracking
- `PATCH /geo-help-board/spots/:spotId` for edits
- `PATCH /geo-help-board/spots/:spotId/deactivate` for soft removal
- `PATCH /geo-help-board/spots/:spotId/review` and `/verification` for admin review

The data model already provides:

- title, description, city, address
- latitude and longitude
- category
- visit count
- review status and review metadata
- active/inactive state
- distance for nearby results

---

## Frontend scope
### V1 pages
1. Campus resources landing page
2. Resource detail surface, either as a drawer or a dedicated detail route
3. Create resource form for authenticated students
4. Optional moderation/admin actions if the current user has the right role

### V1 interactions
- detect or select the user’s location
- fetch nearby resources centered on that location
- allow switching between nearby resources and housing-focused browsing
- filter by category
- search by title, description, or address
- click a map marker or card to inspect a resource
- record a visit when a resource is opened or explicitly marked as visited

---

## Proposed web architecture
Use the same structure already used by the existing web pages:

- `web/src/pages/GeoHelpBoardPage.tsx` for the main page
- `web/src/pages/GeoHelpBoardDetailPage.tsx` if a dedicated detail route is preferred
- `web/src/api/geo-help-board.api.ts` for REST calls
- `web/src/components/geo-help-board/*` for map, cards, filters, and panels
- route registration in `web/src/App.tsx`

Recommended component split:

- `GeoHelpBoardPage` orchestrates state and layout
- `GeoHelpMapPanel` renders the map, legend, and markers
- `GeoHelpLocationBanner` shows current campus/location and update action
- `GeoHelpSearchBar` handles text search
- `GeoHelpCategoryChips` handles category filters
- `GeoHelpResourceCard` renders the list cards
- `GeoHelpResourceDrawer` shows expanded resource details

---

## UI data model
The frontend should normalize backend responses into a small view model:

- `id`
- `title`
- `description`
- `city`
- `address`
- `latitude`
- `longitude`
- `category`
- `distanceKm`
- `visitCount`
- `reviewStatus`
- `isActive`
- `createdById`
- `labels` for hours, amenities, and occupancy if available

UI-specific derived values:

- convert distance from km to miles for display if desired
- map category to a color/icon pair
- derive occupancy badge color from a backend occupancy field or fallback logic
- map `reviewStatus` to moderation-only labels

---

## Backend additions to consider
The current backend is enough for a basic map and list experience, but the screenshots imply richer resource metadata. These are the additions most likely needed to match the design cleanly.

### Required or near-required for screenshot fidelity
1. Broader resource taxonomy
   - The screenshots should be treated as a visual direction, not a fixed category list.
   - The product can group places by how students actually use them: study spots, restaurants, student-discount locations, leisure spots, housing, and similar campus-adjacent places.
   - If the backend keeps a small category enum, add a flexible `OTHER` or `VENUE` bucket plus tags so the frontend can present student-oriented collections without forcing every place into a rigid academic label.

2. Resource metadata fields
   - Add fields such as `operatingHours`, `amenities`, and `capacity` or `seatCount`.
   - The resource cards in the screenshots show hours, tags like WiFi and printers, and occupancy-related information.

3. Occupancy signal
   - Add either `occupancyLevel`, `occupancyPercent`, or enough raw data for the frontend to compute the badge.
   - The current backend only has `visitCount`, which is not the same thing as occupancy.

### Strongly recommended for a polished frontend
4. Text search support
   - Add a `q` or `search` query parameter to the list endpoints.
   - The search bar in the UI should not rely only on client-side filtering once the dataset grows.

5. Resource detail endpoint
   - Add `GET /geo-help-board/spots/:spotId` if the detail drawer needs a single-resource fetch.
   - This is useful if the list response is intentionally lightweight.

6. Viewport-based map loading
   - Add optional bounds filters such as `north`, `south`, `east`, and `west` if map panning should reload visible markers.
   - The current radius-based nearby endpoint is enough for V1, but viewport bounds will scale better for map interactions.

### Optional later additions
7. Favorites or saved resources
8. Photos or attachments
9. User-specific recent visits
10. Admin-only moderation queue surface in the frontend

---

## Suggested frontend behavior
### Initial load
- Determine a campus or default city from profile, onboarding, or browser geolocation.
- If the user denies geolocation, fall back to a campus default.
- Call the nearby endpoint with a reasonable radius.
- Render the map and the first page of cards together.

### Search and filtering
- Keep category chips and search text in local state.
- Requery the backend when category, city, or radius changes.
- If the backend gets a `q` parameter later, wire search to the API instead of filtering only on the client.

### Card interactions
- Clicking a card should highlight the corresponding map marker.
- Clicking a marker should focus the matching card or open a drawer.
- Opening a card should optionally record a visit.

### Admin or owner actions
- Show edit and deactivate actions only when the current user owns the resource or has admin rights.
- Show moderation status only when the user is allowed to see it.

---

## Implementation phases
### Phase 1
- add the route and page shell
- build the location banner, search bar, category chips, and card grid
- wire `popular` and `nearby` API calls
- add loading, empty, and error states

### Phase 2
- add the map panel and marker interactions
- add resource detail drawer or route
- record visits on card open or explicit action

### Phase 3
- add create/edit/deactivate actions
- add moderation/admin affordances if needed
- refine responsive behavior for smaller screens

---

## Acceptance criteria
- The page matches the attached layout direction on desktop.
- Nearby and category-filtered resources load from the existing backend.
- The map and list stay in sync when a user selects a resource.
- The page degrades gracefully if geolocation is unavailable.
- The frontend does not assume backend fields that do not exist yet; any missing resource metadata is called out above as a backend follow-up.

---

## Open backend questions
Before finalizing the UI contract, confirm these points:

- Should the taxonomy be category-first or tag-first for student-facing browsing?
- Which student-oriented collections should be first-class in V1: study spots, food, discounts, housing, leisure, or all of the above?
- Will occupancy be a calculated score, a manual status, or derived from a future capacity model?
- Do we want a dedicated detail endpoint, or should the list responses be fully sufficient?
- Should search be server-side from day one?
- Should the public view hide pending/unverified spots entirely, or allow owners to see their own submissions?

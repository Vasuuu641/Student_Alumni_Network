# Geo Help Board Backend Implementation Plan (Backend-first, AI-later)

## Goal
Build a client-agnostic backend for a geo-based student help board that supports:
- discovering popular student spots in a city,
- finding nearby spots,
- adding new spots,
- tracking visits for popularity ranking.

AI personalization is intentionally out of scope for this phase.

---

## Why web feels trickier than mobile (and how backend should handle it)
Both clients use the same API, but web typically has weaker location access consistency and map rendering differences. To keep frontend complexity low:
- backend accepts explicit coordinates from both clients,
- backend returns normalized geo results (distance + sorted lists),
- backend does not depend on client geolocation internals.

This keeps the backend truly shared and avoids separate behavior per client.

---

## Scope (V1)
1. Spot creation (students)
2. Popular spots endpoint (city/category filters)
3. Nearby spots endpoint (lat/lng/radius)
4. Visit tracking endpoint (updates popularity)

Out of scope:
- moderation workflow,
- comments/photos,
- AI ranking/personalized feed,
- advanced geospatial stack (PostGIS).

---

## Architecture placement (Clean Architecture)
- Domain:
  - `GeoHelpSpot` and `GeoHelpSpotVisit` entities
  - `GeoHelpBoardRepository` contract
- Application:
  - `CreateGeoHelpSpotUseCase`
  - `ListPopularGeoHelpSpotsUseCase`
  - `ListNearbyGeoHelpSpotsUseCase`
  - `RecordGeoHelpSpotVisitUseCase`
- Infrastructure:
  - Prisma repository implementation
  - Bounding-box + Haversine distance filtering
- Presentation:
  - REST controller + DTO validation
  - role guard integration

---

## Data model (V1)
- `GeoHelpSpot`
  - title, city, address, lat/lng, category, createdById, visitCount, isActive, timestamps
- `GeoHelpSpotVisit`
  - spotId, userId, visitedAt
  - unique `(spotId, userId)` to keep a clean popularity signal

Indexes:
- city/category, city/visitCount, lat/lng, spotId/visitedAt

---

## API contract (V1)
Base: `/geo-help-board`

- `GET /spots/popular?city=&category=&limit=`
- `GET /spots/nearby?latitude=&longitude=&radiusKm=&city=&category=&limit=`
- `POST /spots`
- `POST /spots/:spotId/visit`

---

## Delivery phases
### Phase 1 (done)
- schema + migration
- domain contract
- repository implementation
- use cases
- controller + module wiring

### Phase 2 (next)
- integration tests for all endpoints
- seed script with sample city spots
- API docs for frontend/mobile teams

### Phase 3 (later)
- moderation + report flow
- anti-spam/rate-limit for spot creation
- optional PostGIS migration for scale

---

## AI integration handoff (later)
When feed personalization starts, consume this feature as a signal source:
- user-created spots,
- visited spots,
- category/city affinity.

No domain redesign required for that extension.

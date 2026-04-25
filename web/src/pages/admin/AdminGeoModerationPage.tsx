import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, MapPinned, Search, Trash2, XCircle } from 'lucide-react';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import {
  deactivateGeoSpot,
  listGeoReviewQueue,
  reviewGeoSpot,
  type GeoCategory,
  type GeoReviewStatus,
  type GeoSection,
  type GeoSpotForReview,
} from '../../api/admin.api';

const GEO_CATEGORIES: Array<'ALL' | GeoCategory> = [
  'ALL',
  'UNIVERSITY_SERVICE',
  'ACADEMIC_DEPARTMENT',
  'ADMIN_OFFICE',
  'STUDENT_SUPPORT',
  'CAMPUS_FACILITY',
  'RESTAURANT',
  'CAFE',
  'STUDY_SPOT',
  'SOCIAL_HANGOUT',
  'FITNESS_WELLNESS',
  'SHOPPING',
  'OTHER',
];

const GEO_SECTIONS: Array<'ALL' | GeoSection> = ['ALL', 'OFFICIAL_RESOURCE', 'COMMUNITY_PICK'];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const GOOGLE_MAPS_API_KEY = String((import.meta.env as Record<string, string | undefined>).VITE_GOOGLE_MAPS_API ?? '').trim();

function hasValidCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;
}

export function AdminGeoModerationPage() {
  const [spots, setSpots] = useState<GeoSpotForReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'ALL' | GeoReviewStatus>('PENDING');
  const [sectionFilter, setSectionFilter] = useState<'ALL' | GeoSection>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | GeoCategory>('ALL');
  const [searchText, setSearchText] = useState('');
  const [expandedSpotIds, setExpandedSpotIds] = useState<Set<string>>(new Set());

  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useJsApiLoader({
    id: 'admin-geo-mini-map',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    void loadQueue();
  }, [statusFilter, sectionFilter, categoryFilter]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function loadQueue() {
    try {
      setLoading(true);
      setError(null);
      const data = await listGeoReviewQueue({
        reviewStatus: statusFilter === 'ALL' ? undefined : statusFilter,
        section: sectionFilter === 'ALL' ? undefined : sectionFilter,
        category: categoryFilter === 'ALL' ? undefined : categoryFilter,
        isActive: true,
        limit: 100,
      });
      setSpots(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load moderation queue.');
    } finally {
      setLoading(false);
    }
  }

  const filteredSpots = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return spots;

    return spots.filter((spot) => {
      const titleMatch = spot.title.toLowerCase().includes(query);
      const cityMatch = spot.city.toLowerCase().includes(query);
      const addressMatch = (spot.address ?? '').toLowerCase().includes(query);
      return titleMatch || cityMatch || addressMatch;
    });
  }, [spots, searchText]);

  async function handleReview(spotId: string, isVerified: boolean) {
    try {
      setActingId(spotId);
      setError(null);
      const reviewed = await reviewGeoSpot(spotId, isVerified);
      setSpots((prev) => prev.map((spot) => (spot.id === spotId ? reviewed : spot)));
      setNotice(isVerified ? 'Spot approved successfully.' : 'Spot rejected successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply moderation action.');
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(spotId: string) {
    const confirmed = window.confirm('Delete this place? It will be hidden from all users.');
    if (!confirmed) {
      return;
    }

    try {
      setActingId(spotId);
      setError(null);
      await deactivateGeoSpot(spotId);
      setSpots((prev) => prev.filter((spot) => spot.id !== spotId));
      setNotice('Spot deleted successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete geo spot.');
    } finally {
      setActingId(null);
    }
  }

  function toggleExpanded(spotId: string) {
    setExpandedSpotIds((prev) => {
      const next = new Set(prev);
      if (next.has(spotId)) {
        next.delete(spotId);
      } else {
        next.add(spotId);
      }
      return next;
    });
  }

  return (
    <section className="admin-card-stack">
      <header className="admin-page-header">
        <div>
          <h1>Geo Help Board Approvals</h1>
          <p>Review and approve location requests submitted by students and professors.</p>
        </div>
      </header>

      <section className="admin-table-card">
        <div className="admin-table-toolbar">
          <label className="admin-search-wrap">
            <Search size={15} />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by title, city, or address"
            />
          </label>

          <select
            className="admin-filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'ALL' | GeoReviewStatus)}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            className="admin-filter-select"
            value={sectionFilter}
            onChange={(event) => setSectionFilter(event.target.value as 'ALL' | GeoSection)}
          >
            {GEO_SECTIONS.map((section) => (
              <option key={section} value={section}>
                {section === 'ALL' ? 'All Sections' : section === 'OFFICIAL_RESOURCE' ? 'Official Resources' : 'Community Picks'}
              </option>
            ))}
          </select>

          <select
            className="admin-filter-select"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as 'ALL' | GeoCategory)}
          >
            {GEO_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category === 'ALL' ? 'All Categories' : category}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="admin-status admin-status--error">{error}</p> : null}
        {notice ? <p className="admin-status admin-status--success">{notice}</p> : null}

        {loading ? (
          <div className="admin-state-wrap">
            <Loader2 className="spin" size={16} /> Loading review queue...
          </div>
        ) : filteredSpots.length === 0 ? (
          <div className="admin-state-wrap">
            <MapPinned size={16} /> No location requests match your filters.
          </div>
        ) : (
          <div className="admin-geo-grid">
            {filteredSpots.map((spot) => {
              const isPending = spot.reviewStatus === 'PENDING';
              const isBusy = actingId === spot.id;
              const isExpanded = expandedSpotIds.has(spot.id);
              const showMap = hasValidCoordinates(spot.latitude, spot.longitude);

              return (
                <article key={spot.id} className={`admin-geo-card${isExpanded ? ' admin-geo-card--expanded' : ''}`}>
                  <div className="admin-geo-card__head">
                    <h3>{spot.title}</h3>
                    <span className={`admin-status-pill review review--${spot.reviewStatus.toLowerCase()}`}>
                      {spot.reviewStatus}
                    </span>
                  </div>

                  <p className="admin-geo-meta">
                    {spot.city} {spot.address ? `• ${spot.address}` : ''}
                  </p>
                  {spot.description ? <p className="admin-geo-description">{spot.description}</p> : null}

                  <div className="admin-geo-foot">
                    <p>Section: {spot.section === 'OFFICIAL_RESOURCE' ? 'Official Resources' : 'Community Picks'}</p>
                    <p>Category: {spot.category}</p>
                    <p>Submitted: {formatDateTime(spot.createdAt)}</p>
                    <p>Visits: {spot.visitCount}</p>
                  </div>

                  <button
                    type="button"
                    className="admin-geo-expand-btn"
                    onClick={() => toggleExpanded(spot.id)}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {isExpanded ? 'Hide location map' : 'View location map'}
                  </button>

                  {isExpanded ? (
                    <div className="admin-geo-mini-map-wrap">
                      {!showMap ? (
                        <div className="admin-geo-mini-map-empty">No valid pinned coordinates were submitted for this spot.</div>
                      ) : GOOGLE_MAPS_API_KEY.length === 0 ? (
                        <div className="admin-geo-mini-map-empty">Map key missing. Add VITE_GOOGLE_MAPS_API to web/.env.</div>
                      ) : mapLoadError ? (
                        <div className="admin-geo-mini-map-empty">Unable to load map. Check Google Maps API configuration.</div>
                      ) : !isMapLoaded ? (
                        <div className="admin-geo-mini-map-empty"><Loader2 className="spin" size={14} /> Loading location map...</div>
                      ) : (
                        <GoogleMap
                          mapContainerStyle={{ width: '100%', height: '190px' }}
                          center={{ lat: spot.latitude, lng: spot.longitude }}
                          zoom={16}
                          options={{
                            mapTypeControl: false,
                            streetViewControl: false,
                            fullscreenControl: false,
                            clickableIcons: false,
                          }}
                        >
                          <MarkerF
                            position={{ lat: spot.latitude, lng: spot.longitude }}
                            title={spot.title}
                          />
                        </GoogleMap>
                      )}
                    </div>
                  ) : null}

                  <div className="admin-geo-actions">
                    <button
                      className="admin-text-btn success"
                      onClick={() => void handleReview(spot.id, true)}
                      disabled={isBusy || !isPending}
                    >
                      {isBusy ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />}
                      Approve
                    </button>
                    <button
                      className="admin-text-btn danger"
                      onClick={() => void handleReview(spot.id, false)}
                      disabled={isBusy || !isPending}
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                    <button
                      className="admin-text-btn danger"
                      onClick={() => void handleDelete(spot.id)}
                      disabled={isBusy}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

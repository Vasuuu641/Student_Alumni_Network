import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, MapPinned, Search, XCircle } from 'lucide-react';
import {
  listGeoReviewQueue,
  reviewGeoSpot,
  type GeoCategory,
  type GeoReviewStatus,
  type GeoSpotForReview,
} from '../../api/admin.api';

const GEO_CATEGORIES: Array<'ALL' | GeoCategory> = [
  'ALL',
  'STUDY_SPACE',
  'FOOD',
  'TRANSPORT',
  'HOUSING',
  'HEALTH',
  'GYM',
  'LIBRARY',
  'OTHER',
];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminGeoModerationPage() {
  const [spots, setSpots] = useState<GeoSpotForReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'ALL' | GeoReviewStatus>('PENDING');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | GeoCategory>('ALL');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    void loadQueue();
  }, [statusFilter, categoryFilter]);

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
              return (
                <article key={spot.id} className="admin-geo-card">
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
                    <p>Category: {spot.category}</p>
                    <p>Submitted: {formatDateTime(spot.createdAt)}</p>
                    <p>Visits: {spot.visitCount}</p>
                  </div>

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

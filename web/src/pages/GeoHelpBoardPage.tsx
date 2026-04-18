import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPinned, Search, Loader2, Compass, ExternalLink } from 'lucide-react';
import { PlatformTopNav } from '../components/PlatformTopNav';
import Button from '../components/Button';
import { getAccessToken } from '../lib/auth';
import {
  createGeoHelpSpot,
  listNearbyGeoHelpSpots,
  listPopularGeoHelpSpots,
  recordGeoHelpSpotVisit,
  type GeoHelpSpot,
  type GeoHelpSpotCategory,
} from '../api/geo-help-board.api';

type ResourceTab = 'NEARBY' | 'POPULAR';
type CategoryFilter = 'ALL' | GeoHelpSpotCategory;

type LocationState = 'idle' | 'loading' | 'ready' | 'denied' | 'unsupported' | 'error';

const DEFAULT_LOCATION = {
  latitude: 46.072734,
  longitude: 18.232266,
  city: 'Pecs',
};

const CATEGORY_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'STUDY_SPACE', label: 'Study Space' },
  { value: 'LIBRARY', label: 'Library' },
  { value: 'FOOD', label: 'Food' },
  { value: 'HOUSING', label: 'Housing' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'GYM', label: 'Gym' },
  { value: 'OTHER', label: 'Other' },
];

function categoryLabel(value: GeoHelpSpotCategory): string {
  return value.replace('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDistance(distanceKm?: number): string {
  if (typeof distanceKm !== 'number' || Number.isNaN(distanceKm)) {
    return 'Distance unavailable';
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }

  return `${distanceKm.toFixed(1)} km away`;
}

function buildOpenStreetMapUrl(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude.toFixed(6)}&mlon=${longitude.toFixed(6)}#map=16/${latitude.toFixed(6)}/${longitude.toFixed(6)}`;
}

export function GeoHelpBoardPage() {
  const token = getAccessToken();
  const isAuthenticated = Boolean(token);

  const [activeTab, setActiveTab] = useState<ResourceTab>('NEARBY');
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [currentLocation, setCurrentLocation] = useState(DEFAULT_LOCATION);
  const [cityFilter, setCityFilter] = useState(DEFAULT_LOCATION.city);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [searchText, setSearchText] = useState('');
  const [spots, setSpots] = useState<GeoHelpSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState(String(DEFAULT_LOCATION.latitude));
  const [longitude, setLongitude] = useState(String(DEFAULT_LOCATION.longitude));
  const [category, setCategory] = useState<GeoHelpSpotCategory>('STUDY_SPACE');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationState('unsupported');
      return;
    }

    setLocationState('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          city: DEFAULT_LOCATION.city,
        });
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setLocationState('ready');
      },
      (geoError) => {
        setLocationState(geoError.code === geoError.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSpots() {
      try {
        setLoading(true);
        setError(null);

        const city = cityFilter.trim() || undefined;
        const categoryValue = categoryFilter === 'ALL' ? undefined : categoryFilter;
        const response = activeTab === 'NEARBY'
          ? await listNearbyGeoHelpSpots({
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              radiusKm: 8,
              city,
              category: categoryValue,
              limit: 40,
            })
          : await listPopularGeoHelpSpots({
              city,
              category: categoryValue,
              limit: 40,
            });

        if (!cancelled) {
          setSpots(response);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load geo-board resources.');
          setSpots([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSpots();

    return () => {
      cancelled = true;
    };
  }, [activeTab, categoryFilter, cityFilter, currentLocation.latitude, currentLocation.longitude]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredSpots = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return spots;
    }

    return spots.filter((spot) => {
      const values = [spot.title, spot.city, spot.address ?? '', spot.description ?? ''].join(' ').toLowerCase();
      return values.includes(query);
    });
  }, [searchText, spots]);

  async function handleCreateSpot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await createGeoHelpSpot({
        title: title.trim(),
        description: description.trim() || undefined,
        city: cityFilter.trim() || currentLocation.city,
        address: address.trim() || undefined,
        latitude: Number(latitude),
        longitude: Number(longitude),
        category,
      });
      setTitle('');
      setDescription('');
      setAddress('');
      setNotice('Location added successfully.');
      setActiveTab('NEARBY');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create the location.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOpenSpot(spot: GeoHelpSpot) {
    void recordGeoHelpSpotVisit(spot.id).catch(() => undefined);
    window.open(buildOpenStreetMapUrl(spot.latitude, spot.longitude), '_blank', 'noopener,noreferrer');
  }

  return (
    <main className="geo-help-board-page">
      <PlatformTopNav />

      <section className="geo-help-board-shell">
        <header className="geo-help-board-hero">
          <div>
            <p className="geo-help-board-hero__eyebrow">
              <MapPinned size={14} />
              Geo Help Board
            </p>
            <h1>Find study spaces, food, transport, housing, and more around campus.</h1>
            <p>Browse nearby help spots, explore popular locations, and add new places for others to discover.</p>
          </div>
          <div className="geo-help-board-hero__actions">
            <span className="geo-help-board-hero__status">{isAuthenticated ? 'Signed in' : 'Guest browsing'}</span>
            <span className="geo-help-board-hero__status">{locationState === 'ready' ? 'Live location active' : 'Using campus default'}</span>
          </div>
        </header>

        <section className="geo-help-board-toolbar">
          <button type="button" className={activeTab === 'NEARBY' ? 'active' : ''} onClick={() => setActiveTab('NEARBY')}>
            Nearby
          </button>
          <button type="button" className={activeTab === 'POPULAR' ? 'active' : ''} onClick={() => setActiveTab('POPULAR')}>
            Popular
          </button>

          <label className="geo-help-board-toolbar__search">
            <Search size={14} />
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search resources" />
          </label>

          <select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)}>
            <option value="Pecs">Pecs</option>
            <option value="">All cities</option>
          </select>

          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}>
            {CATEGORY_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </section>

        <section className="geo-help-board-body">
          <div className="geo-help-board-main">
            {notice ? <div className="geo-help-board-notice">{notice}</div> : null}
            {error ? <div className="geo-help-board-error">{error}</div> : null}
            {loading ? (
              <div className="geo-help-board-state">
                <Loader2 className="spin" size={16} /> Loading resources...
              </div>
            ) : filteredSpots.length === 0 ? (
              <div className="geo-help-board-state">
                <Compass size={16} /> No locations match your filters yet.
              </div>
            ) : (
              <div className="geo-help-board-list">
                {filteredSpots.map((spot) => (
                  <article key={spot.id} className="geo-help-board-card">
                    <div className="geo-help-board-card__head">
                      <h3>{spot.title}</h3>
                      <span className={`geo-help-board-pill geo-help-board-pill--${spot.reviewStatus.toLowerCase()}`}>
                        {spot.reviewStatus}
                      </span>
                    </div>
                    <p>{spot.description || 'No description added yet.'}</p>
                    <div className="geo-help-board-card__meta">
                      <span>{spot.city}</span>
                      <span>{categoryLabel(spot.category)}</span>
                      <span>{formatDistance(spot.distanceKm)}</span>
                      <span>{spot.visitCount} visits</span>
                    </div>
                    <div className="geo-help-board-card__actions">
                      <button type="button" onClick={() => void handleOpenSpot(spot)}>
                        <ExternalLink size={14} />
                        Open map
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="geo-help-board-sidebar">
            <section className="geo-help-board-panel">
              <h2>Add a location</h2>
              <form onSubmit={(event) => void handleCreateSpot(event)} className="geo-help-board-form">
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" required />
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" rows={3} />
                <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Address" />
                <input value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} placeholder="City" />
                <div className="geo-help-board-form__grid">
                  <input value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="Latitude" />
                  <input value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="Longitude" />
                </div>
                <select value={category} onChange={(event) => setCategory(event.target.value as GeoHelpSpotCategory)}>
                  {CATEGORY_OPTIONS.filter((item) => item.value !== 'ALL').map((item) => (
                    <option key={item.label} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="submit-wide" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Location'}
                </Button>
              </form>
            </section>

            <section className="geo-help-board-panel">
              <h2>Status</h2>
              <p>{locationState === 'ready' ? 'Live location active.' : 'Using campus default location.'}</p>
              <p>
                {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
              </p>
              <Link to={buildOpenStreetMapUrl(currentLocation.latitude, currentLocation.longitude)} target="_blank" rel="noreferrer">
                Open campus map
              </Link>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}

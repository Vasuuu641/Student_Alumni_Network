import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import {
  AlertTriangle,
  Building2,
  Compass,
  ExternalLink,
  Loader2,
  LocateFixed,
  MapPinned,
  Navigation,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { PlatformTopNav } from '../components/PlatformTopNav';
import Button from '../components/Button';
import { getAccessToken } from '../lib/auth';
import {
  listNearbyGeoHelpSpots,
  listPopularGeoHelpSpots,
  recordGeoHelpSpotVisit,
  type GeoHelpSpot,
  type GeoHelpSpotCategory,
  type GeoHelpSpotReviewStatus,
} from '../api/geo-help-board.api';

type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error';
type ResourceTab = 'NEARBY' | 'POPULAR';
type CategoryFilter = 'ALL' | GeoHelpSpotCategory;

interface Point {
  latitude: number;
  longitude: number;
}

const DEFAULT_LOCATION = {
  label: 'Pecs campus default',
  city: 'Pecs',
  latitude: 46.072734,
  longitude: 18.232266,
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

const reverseGeocodeCache = new Map<string, { label: string; city?: string }>();

function toCoordKey(point: Point): string {
  return `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`;
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

function categoryLabel(category: GeoHelpSpotCategory): string {
  return category.replace('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function reviewBadgeClass(reviewStatus: GeoHelpSpotReviewStatus): string {
  if (reviewStatus === 'VERIFIED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (reviewStatus === 'REJECTED') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function locationStateText(status: LocationStatus): string {
  if (status === 'requesting') {
    return 'Requesting browser location permission...';
  }

  if (status === 'granted') {
    return 'Live location is active.';
  }

  if (status === 'denied') {
    return 'Location denied. Using campus default location.';
  }

  if (status === 'unsupported') {
    return 'This browser does not support geolocation. Using campus default location.';
  }

  if (status === 'error') {
    return 'Unable to read location right now. Using campus default location.';
  }

  return 'Using campus default location. You can switch to live location anytime.';
}

function buildOpenStreetMapUrl(point: Point): string {
  return `https://www.openstreetmap.org/?mlat=${point.latitude.toFixed(6)}&mlon=${point.longitude.toFixed(6)}#map=16/${point.latitude.toFixed(6)}/${point.longitude.toFixed(6)}`;
}

async function reverseGeocode(point: Point): Promise<{ label: string; city?: string }> {
  const cacheKey = toCoordKey(point);
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(point.latitude),
    lon: String(point.longitude),
    zoom: '16',
    addressdetails: '1',
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: {
      'Accept-Language': 'en',
    },
  });

  if (!response.ok) {
    throw new Error('Reverse geocoding failed.');
  }

  const data = (await response.json()) as {
    display_name?: string;
    address?: {
      city?: string;
      town?: string;
      village?: string;
      municipality?: string;
      county?: string;
    };
  };

  const city =
    data.address?.city ??
    data.address?.town ??
    data.address?.village ??
    data.address?.municipality ??
    data.address?.county;

  const label = city ?? data.display_name?.split(',').slice(0, 2).join(',').trim() ?? 'Detected location';
  const resolved = { label, city };
  reverseGeocodeCache.set(cacheKey, resolved);
  return resolved;
}

function AutoCenterMap({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
}

export function GeoHelpBoardPage() {
  const navigate = useNavigate();
  const token = getAccessToken();
  const isAuthenticated = Boolean(token);

  const [tab, setTab] = useState<ResourceTab>('NEARBY');
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [radiusKm, setRadiusKm] = useState(5);
  const [searchText, setSearchText] = useState('');
  const [cityFilter, setCityFilter] = useState(DEFAULT_LOCATION.city);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationLabel, setLocationLabel] = useState(DEFAULT_LOCATION.label);
  const [point, setPoint] = useState<Point>({
    latitude: DEFAULT_LOCATION.latitude,
    longitude: DEFAULT_LOCATION.longitude,
  });

  const [spots, setSpots] = useState<GeoHelpSpot[]>([]);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workingSpotId, setWorkingSpotId] = useState<string | null>(null);

  const visitedOnOpenRef = useRef<Set<string>>(new Set());
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const apiCategory = category === 'ALL' ? undefined : category;

  const filteredSpots = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return spots;
    }

    return spots.filter((spot) => {
      return (
        spot.title.toLowerCase().includes(query) ||
        (spot.description ?? '').toLowerCase().includes(query) ||
        (spot.address ?? '').toLowerCase().includes(query) ||
        spot.city.toLowerCase().includes(query)
      );
    });
  }, [searchText, spots]);

  const selectedSpot =
    filteredSpots.find((spot) => spot.id === selectedSpotId) ??
    filteredSpots[0] ??
    null;

  const mapCenterPoint: Point = selectedSpot
    ? { latitude: selectedSpot.latitude, longitude: selectedSpot.longitude }
    : point;

  const mapCenter: [number, number] = [mapCenterPoint.latitude, mapCenterPoint.longitude];

  useEffect(() => {
    if (!selectedSpotId && filteredSpots.length > 0) {
      setSelectedSpotId(filteredSpots[0].id);
      return;
    }

    if (selectedSpotId && filteredSpots.every((spot) => spot.id !== selectedSpotId)) {
      setSelectedSpotId(filteredSpots[0]?.id ?? null);
    }
  }, [filteredSpots, selectedSpotId]);

  useEffect(() => {
    if (!selectedSpotId) {
      return;
    }

    const node = cardRefs.current[selectedSpotId];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedSpotId]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    async function loadResources() {
      try {
        setErrorMessage('');
        setIsLoading(true);

        if (tab === 'NEARBY') {
          const nearby = await listNearbyGeoHelpSpots({
            latitude: point.latitude,
            longitude: point.longitude,
            radiusKm,
            city: cityFilter.trim() || undefined,
            category: apiCategory,
            limit: 30,
            page: 1,
          });

          setSpots(nearby);
          return;
        }

        const popular = await listPopularGeoHelpSpots({
          city: cityFilter.trim() || undefined,
          category: apiCategory,
          limit: 30,
          page: 1,
        });

        setSpots(popular);
      } catch (error) {
        setSpots([]);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load resources.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadResources();
  }, [apiCategory, cityFilter, isAuthenticated, point.latitude, point.longitude, radiusKm, tab]);

  useEffect(() => {
    if (!isDrawerOpen || !selectedSpotId) {
      return;
    }

    if (visitedOnOpenRef.current.has(selectedSpotId)) {
      return;
    }

    visitedOnOpenRef.current.add(selectedSpotId);
    void handleRecordVisit(selectedSpotId, { silentError: true });
  }, [isDrawerOpen, selectedSpotId]);

  function selectSpot(spotId: string, openDrawer = false) {
    setSelectedSpotId(spotId);
    if (openDrawer) {
      setIsDrawerOpen(true);
    }
  }

  async function handleRefresh() {
    if (!isAuthenticated) {
      return;
    }

    try {
      setIsRefreshing(true);
      setErrorMessage('');

      if (tab === 'NEARBY') {
        const nearby = await listNearbyGeoHelpSpots({
          latitude: point.latitude,
          longitude: point.longitude,
          radiusKm,
          city: cityFilter.trim() || undefined,
          category: apiCategory,
          limit: 30,
          page: 1,
        });

        setSpots(nearby);
        return;
      }

      const popular = await listPopularGeoHelpSpots({
        city: cityFilter.trim() || undefined,
        category: apiCategory,
        limit: 30,
        page: 1,
      });

      setSpots(popular);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to refresh resources.');
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      return;
    }

    setLocationStatus('requesting');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setPoint(nextPoint);
        setLocationStatus('granted');

        try {
          const reversed = await reverseGeocode(nextPoint);
          setLocationLabel(reversed.label);
          if (reversed.city) {
            setCityFilter(reversed.city);
          }
        } catch {
          setLocationLabel('Detected location');
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus('denied');
          return;
        }

        setLocationStatus('error');
      },
      {
        enableHighAccuracy: true,
        timeout: 8_000,
        maximumAge: 120_000,
      },
    );
  }

  async function handleRecordVisit(spotId: string, options?: { silentError?: boolean }) {
    try {
      setWorkingSpotId(spotId);
      await recordGeoHelpSpotVisit(spotId);
      setSpots((prev) => prev.map((spot) => (
        spot.id === spotId
          ? {
            ...spot,
            visitCount: spot.visitCount + 1,
          }
          : spot
      )));
    } catch (error) {
      if (!options?.silentError) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to record visit.');
      }
    } finally {
      setWorkingSpotId(null);
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center text-slate-900">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <MapPinned size={22} />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold">Sign in to browse campus resources</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Geo Help Board is available to authenticated users. Sign in to discover nearby study spots, housing, transport, and essential campus services.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="get-started" className="flex-1" onClick={() => navigate('/login')}>
              Sign in
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/register')}>
              Create account
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PlatformTopNav />

      <section className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Campus Resources</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Interactive map markers + detail drawer. Pick a resource from map or list, then open full details.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>

        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-start gap-3">
              <div className="mt-1 rounded-lg bg-sky-100 p-2 text-sky-700">
                <LocateFixed size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Location</p>
                <p className="text-lg font-bold text-slate-900">{locationLabel}</p>
                <p className="text-xs text-slate-600">{locationStateText(locationStatus)}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locationStatus === 'requesting'}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {locationStatus === 'requesting' ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />}
              Use my location
            </button>
          </div>
        </section>

        <section className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search title, address, description, city"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <input
            value={cityFilter}
            onChange={(event) => setCityFilter(event.target.value)}
            placeholder="City"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
        </section>

        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {(['NEARBY', 'POPULAR'] as ResourceTab[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  tab === item
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                }`}
              >
                {item === 'NEARBY' ? 'Nearby' : 'Popular'}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <label htmlFor="radiusKm" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Radius
              </label>
              <select
                id="radiusKm"
                value={radiusKm}
                onChange={(event) => setRadiusKm(Number(event.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
                disabled={tab !== 'NEARBY'}
              >
                <option value={2}>2 km</option>
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={20}>20 km</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCategory(item.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  category === item.value
                    ? 'border-sky-300 bg-sky-100 text-sky-800'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {errorMessage ? (
          <section className="mb-4 inline-flex w-full items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            <AlertTriangle size={16} />
            {errorMessage}
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="inline-flex items-center gap-2">
                <Compass size={16} className="text-sky-700" />
                <p className="text-sm font-semibold text-slate-700">Interactive map</p>
              </div>
              <a
                href={buildOpenStreetMapUrl(mapCenterPoint)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
              >
                Open full map <ExternalLink size={12} />
              </a>
            </header>

            <MapContainer
              center={mapCenter}
              zoom={15}
              className="h-[420px] w-full"
              scrollWheelZoom
            >
              <AutoCenterMap center={mapCenter} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <Circle
                center={[point.latitude, point.longitude]}
                radius={Math.max(80, radiusKm * 120)}
                pathOptions={{ color: '#0ea5e9', fillColor: '#38bdf8', fillOpacity: 0.1 }}
              />

              <CircleMarker
                center={[point.latitude, point.longitude]}
                radius={8}
                pathOptions={{ color: '#0284c7', fillColor: '#0284c7', fillOpacity: 0.9 }}
              >
                <Popup>Your current center point</Popup>
              </CircleMarker>

              {filteredSpots.map((spot) => {
                const isSelected = selectedSpotId === spot.id;
                return (
                  <CircleMarker
                    key={spot.id}
                    center={[spot.latitude, spot.longitude]}
                    radius={isSelected ? 11 : 8}
                    pathOptions={{
                      color: isSelected ? '#1d4ed8' : '#0f766e',
                      fillColor: isSelected ? '#3b82f6' : '#14b8a6',
                      fillOpacity: 0.85,
                    }}
                    eventHandlers={{
                      click: () => {
                        selectSpot(spot.id, true);
                      },
                    }}
                  >
                    <Popup>
                      <div className="min-w-[170px]">
                        <p className="text-sm font-bold text-slate-900">{spot.title}</p>
                        <p className="mt-1 text-xs text-slate-600">{spot.city}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-700">{formatDistance(spot.distanceKm)}</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Resource list</h2>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {filteredSpots.length} result{filteredSpots.length === 1 ? '' : 's'}
              </p>
            </div>

            {isLoading ? (
              <div className="flex h-72 items-center justify-center text-slate-500">
                <Loader2 size={18} className="mr-2 animate-spin" />
                Loading resources...
              </div>
            ) : null}

            {!isLoading && filteredSpots.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                <Building2 size={22} className="text-slate-500" />
                <p className="mt-2 text-sm font-semibold text-slate-700">No resources found</p>
                <p className="mt-1 text-xs text-slate-500">
                  Try a broader radius, switch tab, or clear search/category filters.
                </p>
              </div>
            ) : null}

            {!isLoading ? (
              <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
                {filteredSpots.map((spot) => {
                  const isSelected = selectedSpotId === spot.id;
                  return (
                    <article
                      key={spot.id}
                      ref={(node) => {
                        cardRefs.current[spot.id] = node;
                      }}
                      className={`rounded-xl border p-3 transition ${
                        isSelected
                          ? 'border-sky-300 bg-sky-50/50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectSpot(spot.id, true)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{spot.title}</h3>
                          <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            {categoryLabel(spot.category)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {spot.address ? `${spot.address}, ${spot.city}` : spot.city}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            {formatDistance(spot.distanceKm)}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${reviewBadgeClass(spot.reviewStatus)}`}>
                            {spot.reviewStatus}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            {spot.visitCount} visits
                          </span>
                        </div>
                        {spot.description ? (
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{spot.description}</p>
                        ) : null}
                      </button>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => selectSpot(spot.id, true)}
                          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          View details
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleRecordVisit(spot.id);
                          }}
                          disabled={workingSpotId === spot.id}
                          className="inline-flex items-center rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {workingSpotId === spot.id ? 'Saving...' : 'Mark visited'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </article>
        </section>
      </section>

      {isDrawerOpen && selectedSpot ? (
        <>
          <button
            type="button"
            aria-label="Close resource drawer"
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/35"
          />
          <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-auto border-l border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resource details</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">{selectedSpot.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                {categoryLabel(selectedSpot.category)}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${reviewBadgeClass(selectedSpot.reviewStatus)}`}>
                {selectedSpot.reviewStatus}
              </span>
              <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                {formatDistance(selectedSpot.distanceKm)}
              </span>
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</p>
              <p className="text-sm text-slate-700">
                {selectedSpot.address ? `${selectedSpot.address}, ${selectedSpot.city}` : selectedSpot.city}
              </p>

              {selectedSpot.description ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                  <p className="text-sm leading-6 text-slate-700">{selectedSpot.description}</p>
                </>
              ) : null}

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visits</p>
              <p className="text-sm text-slate-700">{selectedSpot.visitCount} total visits</p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={buildOpenStreetMapUrl({ latitude: selectedSpot.latitude, longitude: selectedSpot.longitude })}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Open in map <ExternalLink size={13} />
              </a>
              <button
                type="button"
                onClick={() => {
                  void handleRecordVisit(selectedSpot.id);
                }}
                disabled={workingSpotId === selectedSpot.id}
                className="inline-flex items-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {workingSpotId === selectedSpot.id ? 'Saving...' : 'Mark visited'}
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </main>
  );
}

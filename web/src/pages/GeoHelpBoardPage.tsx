import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Circle, CircleMarker, MapContainer, Marker, Popup, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { divIcon, latLngBounds, type LatLngBoundsExpression } from 'leaflet';
import {
  AlertTriangle,
  Building2,
  Compass,
  ExternalLink,
  Loader2,
  LocateFixed,
  MapPinned,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { PlatformTopNav } from '../components/PlatformTopNav';
import Button from '../components/Button';
import { getAccessToken } from '../lib/auth';
import {
  createGeoHelpSpot,
  listNearbyGeoHelpSpots,
  recordGeoHelpSpotVisit,
  type GeoHelpSpot,
  type GeoHelpSpotCategory,
  type GeoHelpSpotReviewStatus,
} from '../api/geo-help-board.api';

type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'insecure' | 'error';
type CategoryFilter = 'ALL' | GeoHelpSpotCategory;

interface Point {
  latitude: number;
  longitude: number;
}

interface SearchLocationCandidate {
  label: string;
  city?: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
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

const CREATE_CATEGORY_OPTIONS: Array<{ value: GeoHelpSpotCategory; label: string }> = CATEGORY_OPTIONS
  .filter((item): item is { value: GeoHelpSpotCategory; label: string } => item.value !== 'ALL');

const reverseGeocodeCache = new Map<string, { label: string; city?: string }>();
const searchGeocodeCache = new Map<string, { label: string; city?: string; latitude: number; longitude: number }>();
const searchCandidateCache = new Map<string, SearchLocationCandidate[]>();

function toCoordKey(point: Point): string {
  return `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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

function haversineDistanceKm(from: Point, to: Point): number {
  const earthRadiusKm = 6371;
  const latDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
  const lonDelta = ((to.longitude - from.longitude) * Math.PI) / 180;

  const fromLat = (from.latitude * Math.PI) / 180;
  const toLat = (to.latitude * Math.PI) / 180;

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) * Math.sin(lonDelta / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatAccuracy(accuracyMeters?: number): string {
  if (typeof accuracyMeters !== 'number' || Number.isNaN(accuracyMeters)) {
    return 'Location accuracy unavailable';
  }

  if (accuracyMeters < 1000) {
    return `Approx. ${Math.round(accuracyMeters)} m accuracy`;
  }

  return `Approx. ${(accuracyMeters / 1000).toFixed(1)} km accuracy`;
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

  if (status === 'insecure') {
    return 'Browser location requires HTTPS or localhost. Using campus default location.';
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

type RawSearchResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
  };
};

async function searchLocationCandidates(
  query: string,
  options?: { nearPoint?: Point; cityHint?: string; strictLocal?: boolean; maxResults?: number },
): Promise<SearchLocationCandidate[]> {
  const normalizedQuery = query.trim();
  const nearKey = options?.nearPoint
    ? `${options.nearPoint.latitude.toFixed(3)},${options.nearPoint.longitude.toFixed(3)}`
    : '';
  const cacheKey = [
    normalizeSearchText(normalizedQuery),
    normalizeSearchText(options?.cityHint ?? ''),
    nearKey,
    options?.strictLocal ? 'strict' : 'loose',
  ].join('::');

  const cached = searchCandidateCache.get(cacheKey);
  if (cached) {
    return cached.slice(0, options?.maxResults ?? 8);
  }

  const candidates = options?.cityHint
    ? [`${normalizedQuery}, ${options.cityHint}`, normalizedQuery]
    : [normalizedQuery];

  const normalizedCityHint = options?.cityHint ? normalizeSearchText(options.cityHint) : undefined;

  const extractCity = (item: RawSearchResult): string | undefined => {
    return (
      item.address?.city ??
      item.address?.town ??
      item.address?.village ??
      item.address?.municipality ??
      item.address?.county
    );
  };

  const cityMatchesHint = (item: RawSearchResult): boolean => {
    if (!normalizedCityHint) {
      return true;
    }

    const resolvedCityRaw = extractCity(item);
    if (!resolvedCityRaw) {
      // In bounded-local mode, Nominatim sometimes omits city fields even for nearby matches.
      return true;
    }

    const resolvedCity = normalizeSearchText(resolvedCityRaw);
    if (!resolvedCity) {
      return true;
    }

    return resolvedCity.includes(normalizedCityHint) || normalizedCityHint.includes(resolvedCity);
  };

  const dedupeByPoint = (results: RawSearchResult[]): RawSearchResult[] => {
    const seen = new Set<string>();
    const deduped: RawSearchResult[] = [];

    for (const item of results) {
      if (!item.lat || !item.lon) {
        continue;
      }

      const key = `${Number(item.lat).toFixed(5)}:${Number(item.lon).toFixed(5)}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      deduped.push(item);
    }

    return deduped;
  };

  const toCandidates = (results: RawSearchResult[]): SearchLocationCandidate[] => {
    const candidates: SearchLocationCandidate[] = [];

    for (const item of dedupeByPoint(results)) {
      if (!item.lat || !item.lon) {
        continue;
      }

      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      const city = extractCity(item);
      const distanceKm = options?.nearPoint
        ? haversineDistanceKm(options.nearPoint, { latitude, longitude })
        : undefined;

      candidates.push({
        label: item.display_name?.split(',').slice(0, 2).join(',').trim() ?? normalizedQuery,
        city,
        latitude,
        longitude,
        distanceKm,
      });
    }

    return candidates.sort((a, b) => {
      const aDistance = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const bDistance = b.distanceKm ?? Number.POSITIVE_INFINITY;
      return aDistance - bDistance;
    });
  };

  const parseResults = async (candidate: string, localOnly: boolean) => {
    const params = new URLSearchParams({
      format: 'jsonv2',
      q: candidate,
      addressdetails: '1',
      limit: '12',
    });

    if (localOnly && options?.nearPoint) {
      const latDelta = 6 / 111;
      const lonDelta = 6 / (111 * Math.max(Math.cos((options.nearPoint.latitude * Math.PI) / 180), 0.2));
      const left = options.nearPoint.longitude - lonDelta;
      const right = options.nearPoint.longitude + lonDelta;
      const top = options.nearPoint.latitude + latDelta;
      const bottom = options.nearPoint.latitude - latDelta;

      params.set('viewbox', `${left},${top},${right},${bottom}`);
      params.set('bounded', '1');
    }

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) {
      throw new Error('Location search failed.');
    }

    return (await response.json()) as RawSearchResult[];
  };

  const localAggregated: RawSearchResult[] = [];

  for (const candidate of candidates) {
    const localResults = await parseResults(candidate, true);
    localAggregated.push(...localResults);
  }

  const localPreferred = normalizedCityHint
    ? localAggregated.filter((item) => cityMatchesHint(item))
    : localAggregated;

  const localCandidates = toCandidates(localPreferred.length > 0 ? localPreferred : localAggregated);
  if (localCandidates.length > 0) {
    searchCandidateCache.set(cacheKey, localCandidates);
    return localCandidates.slice(0, options?.maxResults ?? 8);
  }

  if (options?.strictLocal) {
    throw new Error(
      `No nearby match found${options.cityHint ? ` in ${options.cityHint}` : ' in your area'}. Try a more specific name or full address.`,
    );
  }

  const globalAggregated: RawSearchResult[] = [];
  for (const candidate of candidates) {
    const globalResults = await parseResults(candidate, false);
    globalAggregated.push(...globalResults);
  }

  const globalPreferred = normalizedCityHint
    ? globalAggregated.filter((item) => cityMatchesHint(item))
    : globalAggregated;

  const globalCandidates = toCandidates(globalPreferred.length > 0 ? globalPreferred : globalAggregated);
  if (globalCandidates.length === 0) {
    throw new Error('No matching location was found.');
  }

  searchCandidateCache.set(cacheKey, globalCandidates);
  return globalCandidates.slice(0, options?.maxResults ?? 8);
}

async function searchLocation(
  query: string,
  options?: { nearPoint?: Point; cityHint?: string; strictLocal?: boolean },
): Promise<{ label: string; city?: string; latitude: number; longitude: number }> {
  const normalizedQuery = query.trim();
  const cacheKey = `${normalizeSearchText(normalizedQuery)}::${normalizeSearchText(options?.cityHint ?? '')}`;
  const cached = searchGeocodeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const candidates = await searchLocationCandidates(query, {
    nearPoint: options?.nearPoint,
    cityHint: options?.cityHint,
    strictLocal: options?.strictLocal,
    maxResults: 1,
  });

  const first = candidates[0];
  if (!first) {
    throw new Error('No matching location was found.');
  }

  const resolved = {
    label: first.label,
    city: first.city,
    latitude: first.latitude,
    longitude: first.longitude,
  };

  searchGeocodeCache.set(cacheKey, resolved);
  return resolved;
}

function MapViewportController({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 15), { animate: true });
      return;
    }

    const bounds: LatLngBoundsExpression = latLngBounds(points);
    map.fitBounds(bounds, {
      animate: true,
      padding: [48, 48],
      maxZoom: 16,
    });
  }, [map, points]);

  return null;
}

function MapZoomBridge({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  useMapEvents({
    zoomend(event) {
      onZoomChange(event.target.getZoom());
    },
  });

  return null;
}

interface ClusterItem {
  key: string;
  latitude: number;
  longitude: number;
  spots: GeoHelpSpot[];
}

function getClusterPrecision(zoom: number): number | null {
  if (zoom >= 16) {
    return null;
  }

  if (zoom >= 14) {
    return 3;
  }

  if (zoom >= 12) {
    return 2;
  }

  return 1;
}

function clusterSpots(spots: GeoHelpSpot[], zoom: number): ClusterItem[] {
  const precision = getClusterPrecision(zoom);
  if (precision === null) {
    return spots.map((spot) => ({
      key: spot.id,
      latitude: spot.latitude,
      longitude: spot.longitude,
      spots: [spot],
    }));
  }

  const grouped = new Map<string, GeoHelpSpot[]>();

  spots.forEach((spot) => {
    const key = `${spot.latitude.toFixed(precision)}:${spot.longitude.toFixed(precision)}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.push(spot);
      return;
    }

    grouped.set(key, [spot]);
  });

  return Array.from(grouped.entries()).map(([key, bucket]) => {
    const latitude = bucket.reduce((sum, spot) => sum + spot.latitude, 0) / bucket.length;
    const longitude = bucket.reduce((sum, spot) => sum + spot.longitude, 0) / bucket.length;

    return {
      key,
      latitude,
      longitude,
      spots: bucket,
    };
  });
}

function buildSpotIcon(isSelected: boolean) {
  return divIcon({
    className: '',
    html: `
      <div style="
        width: 18px;
        height: 18px;
        border-radius: 9999px;
        border: 2px solid ${isSelected ? '#1d4ed8' : '#ffffff'};
        background: ${isSelected ? '#2563eb' : '#0f766e'};
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.22);
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function buildClusterIcon(count: number, isSelected: boolean) {
  const diameter = Math.min(52, 28 + count * 4);

  return divIcon({
    className: '',
    html: `
      <div style="
        width: ${diameter}px;
        height: ${diameter}px;
        border-radius: 9999px;
        display: grid;
        place-items: center;
        border: 2px solid ${isSelected ? '#1d4ed8' : '#ffffff'};
        background: linear-gradient(180deg, ${isSelected ? '#60a5fa' : '#14b8a6'} 0%, ${isSelected ? '#2563eb' : '#0f766e'} 100%);
        color: white;
        font-size: 12px;
        font-weight: 800;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.24);
      ">${count}</div>
    `,
    iconSize: [diameter, diameter],
    iconAnchor: [diameter / 2, diameter / 2],
  });
}

function buildDestinationIcon() {
  return divIcon({
    className: '',
    html: `
      <div style="
        width: 16px;
        height: 16px;
        border-radius: 9999px;
        border: 2px solid #ffffff;
        background: #f97316;
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.22);
      "></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function MapResourceMarkers({
  clusters,
  selectedSpotId,
  onSelectSpot,
}: {
  clusters: ClusterItem[];
  selectedSpotId: string | null;
  onSelectSpot: (spotId: string, openDrawer?: boolean) => void;
}) {
  const map = useMap();

  return (
    <>
      {clusters.map((cluster) => {
        const selectedInCluster = cluster.spots.some((spot) => spot.id === selectedSpotId);

        if (cluster.spots.length === 1) {
          const spot = cluster.spots[0];
          return (
            <Marker
              key={cluster.key}
              position={[spot.latitude, spot.longitude]}
              icon={buildSpotIcon(spot.id === selectedSpotId)}
              eventHandlers={{
                click: () => {
                  onSelectSpot(spot.id, true);
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
            </Marker>
          );
        }

        return (
          <Marker
            key={cluster.key}
            position={[cluster.latitude, cluster.longitude]}
            icon={buildClusterIcon(cluster.spots.length, selectedInCluster)}
            eventHandlers={{
              click: () => {
                map.flyTo([cluster.latitude, cluster.longitude], Math.min(map.getZoom() + 2, 17), {
                  animate: true,
                });
                const firstSpot = cluster.spots[0];
                onSelectSpot(firstSpot.id, false);
              },
            }}
          >
            <Popup>
              <div className="min-w-[190px]">
                <p className="text-sm font-bold text-slate-900">{cluster.spots.length} nearby resources</p>
                <p className="mt-1 text-xs text-slate-600">Zoom in to see individual markers.</p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export function GeoHelpBoardPage() {
  const navigate = useNavigate();
  const token = getAccessToken();
  const isAuthenticated = Boolean(token);

  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [radiusKm, setRadiusKm] = useState(5);
  const [searchText, setSearchText] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [searchCandidates, setSearchCandidates] = useState<SearchLocationCandidate[]>([]);
  const [cityFilter, setCityFilter] = useState(DEFAULT_LOCATION.city);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationLabel, setLocationLabel] = useState(DEFAULT_LOCATION.label);
  const [locationNote, setLocationNote] = useState('');
  const [locationAccuracyM, setLocationAccuracyM] = useState<number | null>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [devicePoint, setDevicePoint] = useState<Point | null>(null);
  const [searchDestination, setSearchDestination] = useState<{ label: string; point: Point } | null>(null);
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
  const [mapZoom, setMapZoom] = useState(15);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingSpot, setIsCreatingSpot] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createCity, setCreateCity] = useState(DEFAULT_LOCATION.city);
  const [createAddress, setCreateAddress] = useState('');
  const [createCategory, setCreateCategory] = useState<GeoHelpSpotCategory>('STUDY_SPACE');
  const [createLatitude, setCreateLatitude] = useState(String(DEFAULT_LOCATION.latitude));
  const [createLongitude, setCreateLongitude] = useState(String(DEFAULT_LOCATION.longitude));

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

  const currentLocationPoint = devicePoint ?? point;
  const destinationDistanceKm = searchDestination
    ? haversineDistanceKm(currentLocationPoint, searchDestination.point)
    : null;

  const mapCenter: [number, number] = [mapCenterPoint.latitude, mapCenterPoint.longitude];
  const mapClusters = useMemo(() => clusterSpots(filteredSpots, mapZoom), [filteredSpots, mapZoom]);
  const mapPoints = useMemo<Array<[number, number]>>(
    () => {
      const points = filteredSpots.map((spot) => [spot.latitude, spot.longitude] as [number, number]);
      points.push([currentLocationPoint.latitude, currentLocationPoint.longitude]);
      if (searchDestination) {
        points.push([searchDestination.point.latitude, searchDestination.point.longitude]);
      }
      return points;
    },
    [filteredSpots, currentLocationPoint.latitude, currentLocationPoint.longitude, searchDestination],
  );

  useEffect(() => {
    if (searchText.trim().length === 0) {
      setSearchCandidates([]);
    }
  }, [searchText]);

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
      } catch (error) {
        setSpots([]);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load resources.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadResources();
  }, [apiCategory, cityFilter, isAuthenticated, point.latitude, point.longitude, radiusKm]);

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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to refresh resources.');
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      setLocationNote('Your browser does not expose the geolocation API on this device.');
      return;
    }

    if (!window.isSecureContext) {
      setLocationStatus('insecure');
      setLocationNote('Browser location is blocked on insecure origins. Open the web app on HTTPS or localhost, then try again.');
      return;
    }

    setLocationStatus('requesting');
    setLocationNote('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setPoint(nextPoint);
        setDevicePoint(nextPoint);
        setSearchDestination(null);
        setLocationAccuracyM(position.coords.accuracy);
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
          setLocationNote('Browser permission was denied or disabled. Allow location access in the site settings and try again.');
          return;
        }

        if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationNote('The browser could not resolve a usable location from GPS, Wi-Fi, or network signals.');
        } else if (error.code === error.TIMEOUT) {
          setLocationNote('Location lookup timed out. Try again or move to a place with a stronger signal.');
        } else {
          setLocationNote(error.message || 'The browser returned an unexpected geolocation error.');
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

  async function handleRefineLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = locationQuery.trim();
    if (!query) {
      setErrorMessage('Enter an address or place name to refine the location.');
      return;
    }

    try {
      setIsRefreshing(true);
      setErrorMessage('');

      const result = await searchLocation(query, {
        nearPoint: devicePoint ?? point,
        cityHint: cityFilter.trim() || undefined,
        strictLocal: true,
      });
      const nextPoint = {
        latitude: result.latitude,
        longitude: result.longitude,
      };

      setPoint(nextPoint);
      setDevicePoint(nextPoint);
      setSearchDestination(null);
      setLocationStatus('granted');
      setLocationLabel(result.label);
      setLocationNote('Refined from the typed location query.');
      setLocationAccuracyM(35);
      if (result.city) {
        setCityFilter(result.city);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to refine location.');
    } finally {
      setIsRefreshing(false);
    }
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

  async function handleSearchAsLocation() {
    const query = searchText.trim();
    if (!query) {
      return;
    }

    try {
      setIsSearchingLocation(true);
      setErrorMessage('');
      setSearchCandidates([]);

      const candidates = await searchLocationCandidates(query, {
        nearPoint: devicePoint ?? point,
        cityHint: cityFilter.trim() || undefined,
        strictLocal: true,
        maxResults: 6,
      });

      if (candidates.length === 0) {
        throw new Error('No nearby match found. Try a fuller place name or address.');
      }

      if (candidates.length > 1) {
        setSearchCandidates(candidates);
        setLocationNote('Multiple nearby matches found. Choose one from the list.');
        return;
      }

      const selectedCandidate = candidates[0];
      const nextPoint = {
        latitude: selectedCandidate.latitude,
        longitude: selectedCandidate.longitude,
      };

      setSearchDestination({ label: selectedCandidate.label, point: nextPoint });
      const referencePoint = devicePoint ?? point;
      const searchDistanceKm = haversineDistanceKm(referencePoint, nextPoint);
      if (searchDistanceKm > 40) {
        setLocationNote('No nearby match found. Showing the closest global match for this query.');
      } else {
        setLocationNote('Destination found from search query.');
      }
      setSearchText('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not find a matching place for this search.');
    } finally {
      setIsSearchingLocation(false);
    }
  }

  function handleSelectSearchCandidate(candidate: SearchLocationCandidate) {
    const nextPoint = {
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    };

    setSearchDestination({ label: candidate.label, point: nextPoint });
    setSearchCandidates([]);
    setSearchText('');
    setLocationNote('Destination selected from nearby matches.');
  }

  function openCreateModal() {
    setCreateError('');
    setCreateTitle('');
    setCreateDescription('');
    setCreateCity(cityFilter.trim() || DEFAULT_LOCATION.city);
    setCreateAddress('');
    setCreateCategory('STUDY_SPACE');
    setCreateLatitude(point.latitude.toFixed(6));
    setCreateLongitude(point.longitude.toFixed(6));
    setIsCreateModalOpen(true);
  }

  async function handleCreateSpot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = createTitle.trim();
    const city = createCity.trim();
    const address = createAddress.trim();
    const latitude = Number(createLatitude);
    const longitude = Number(createLongitude);

    if (!title || !city) {
      setCreateError('Title and city are required.');
      return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setCreateError('Latitude and longitude must be valid numbers.');
      return;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setCreateError('Coordinates are out of range.');
      return;
    }

    try {
      setIsCreatingSpot(true);
      setCreateError('');

      const created = await createGeoHelpSpot({
        title,
        description: createDescription.trim() || undefined,
        city,
        address: address || undefined,
        latitude,
        longitude,
        category: createCategory,
      });

      setIsCreateModalOpen(false);
      setPoint({ latitude: created.latitude, longitude: created.longitude });
      setSearchDestination(null);
      setSelectedSpotId(created.id);
      await handleRefresh();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create location.');
    } finally {
      setIsCreatingSpot(false);
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
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
          >
            <Plus size={15} />
            Add resource
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
                <p className="mt-1 text-xs font-medium text-slate-500">{formatAccuracy(locationAccuracyM ?? undefined)}</p>
                {locationNote ? <p className="mt-1 text-xs text-slate-500">{locationNote}</p> : null}
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

          <form
            onSubmit={(event) => {
              void handleRefineLocation(event);
            }}
            className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"
          >
            <input
              value={locationQuery}
              onChange={(event) => setLocationQuery(event.target.value)}
              placeholder="Refine location with an address or place name, e.g. Hungaria utca 49/c"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
            <button
              type="submit"
              disabled={isRefreshing || locationQuery.trim().length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Search size={16} />
              Set exact location
            </button>
          </form>
        </section>

        <section className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]">
          <div className="relative md:col-span-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Filter loaded resources, or search a place then click Search place"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSearchAsLocation();
                }
              }}
            />
          </div>
          <input
            value={cityFilter}
            onChange={(event) => setCityFilter(event.target.value)}
            placeholder="City"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
          <button
            type="button"
            onClick={() => {
              void handleSearchAsLocation();
            }}
            disabled={isSearchingLocation || searchText.trim().length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSearchingLocation ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search place
          </button>
          {searchDestination ? (
            <p className="md:col-span-2 text-xs text-slate-600">
              Destination: <span className="font-semibold text-slate-800">{searchDestination.label}</span>
              {' '}({formatDistance(destinationDistanceKm ?? undefined)} from your location)
            </p>
          ) : null}

          {searchCandidates.length > 1 ? (
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Select a nearby match</p>
              <div className="space-y-2">
                {searchCandidates.map((candidate) => (
                  <button
                    key={`${candidate.latitude}:${candidate.longitude}:${candidate.label}`}
                    type="button"
                    onClick={() => handleSelectSearchCandidate(candidate)}
                    className="flex w-full items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
                  >
                    <span>
                      <span className="font-semibold text-slate-900">{candidate.label}</span>
                      {candidate.city ? <span className="block text-xs text-slate-500">{candidate.city}</span> : null}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">{formatDistance(candidate.distanceKm)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {errorMessage ? (
          <section className="mb-4 inline-flex w-full items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            <AlertTriangle size={16} />
            {errorMessage}
          </section>
        ) : null}

        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
            className="h-[460px] w-full"
            scrollWheelZoom
          >
            <MapViewportController points={mapPoints} />
            <MapZoomBridge onZoomChange={setMapZoom} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <Circle
              center={[currentLocationPoint.latitude, currentLocationPoint.longitude]}
              radius={locationAccuracyM ?? Math.max(80, radiusKm * 120)}
              pathOptions={{ color: '#0ea5e9', fillColor: '#38bdf8', fillOpacity: 0.1 }}
            />

            <CircleMarker
              center={[currentLocationPoint.latitude, currentLocationPoint.longitude]}
              radius={8}
              pathOptions={{ color: '#0284c7', fillColor: '#0284c7', fillOpacity: 0.9 }}
            >
              <Popup>Your current center point</Popup>
            </CircleMarker>

            {searchDestination ? (
              <Marker
                position={[searchDestination.point.latitude, searchDestination.point.longitude]}
                icon={buildDestinationIcon()}
              >
                <Popup>
                  <div className="min-w-[170px]">
                    <p className="text-sm font-bold text-slate-900">Destination</p>
                    <p className="mt-1 text-xs text-slate-600">{searchDestination.label}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-700">{formatDistance(destinationDistanceKm ?? undefined)} from your location</p>
                  </div>
                </Popup>
              </Marker>
            ) : null}

            {searchDestination ? (
              <Polyline
                positions={[
                  [currentLocationPoint.latitude, currentLocationPoint.longitude],
                  [searchDestination.point.latitude, searchDestination.point.longitude],
                ]}
                pathOptions={{ color: '#f97316', weight: 2, dashArray: '6 6' }}
              />
            ) : null}

            <MapResourceMarkers clusters={mapClusters} selectedSpotId={selectedSpotId} onSelectSpot={selectSpot} />
          </MapContainer>
        </section>

        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">Resource Type</span>

            <div className="ml-auto flex items-center gap-2">
              <label htmlFor="radiusKm" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Radius
              </label>
              <select
                id="radiusKm"
                value={radiusKm}
                onChange={(event) => setRadiusKm(Number(event.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
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

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Locations</h2>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {filteredSpots.length} result{filteredSpots.length === 1 ? '' : 's'}
            </p>
          </div>

          {isLoading ? (
            <div className="flex h-52 items-center justify-center text-slate-500">
              <Loader2 size={18} className="mr-2 animate-spin" />
              Loading resources...
            </div>
          ) : null}

          {!isLoading && filteredSpots.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
              <Building2 size={22} className="text-slate-500" />
              <p className="mt-2 text-sm font-semibold text-slate-700">No resources found</p>
              <p className="mt-1 text-xs text-slate-500">
                Try a broader radius or clear search/category filters.
              </p>
            </div>
          ) : null}

          {!isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
          <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-auto border-l border-slate-200 bg-white p-5 shadow-2xl max-sm:top-auto max-sm:bottom-0 max-sm:h-[85vh] max-sm:max-w-none max-sm:rounded-t-3xl max-sm:border-l-0 max-sm:border-t max-sm:p-4">
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

      {isCreateModalOpen ? (
        <>
          <button
            type="button"
            aria-label="Close create resource modal"
            onClick={() => setIsCreateModalOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/35"
          />
          <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-auto border-l border-slate-200 bg-white p-5 shadow-2xl max-sm:top-auto max-sm:bottom-0 max-sm:h-[90vh] max-sm:max-w-none max-sm:rounded-t-3xl max-sm:border-l-0 max-sm:border-t max-sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Create resource</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">Add a new location</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                void handleCreateSpot(event);
              }}
            >
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Title</label>
                <input
                  value={createTitle}
                  onChange={(event) => setCreateTitle(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  placeholder="Main Library"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
                <select
                  value={createCategory}
                  onChange={(event) => setCreateCategory(event.target.value as GeoHelpSpotCategory)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                >
                  {CREATE_CATEGORY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">City</label>
                <input
                  value={createCity}
                  onChange={(event) => setCreateCity(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  placeholder="Pecs"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Address</label>
                <input
                  value={createAddress}
                  onChange={(event) => setCreateAddress(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  placeholder="Hungaria utca 49/c"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Latitude</label>
                  <input
                    value={createLatitude}
                    onChange={(event) => setCreateLatitude(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    placeholder="46.072734"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Longitude</label>
                  <input
                    value={createLongitude}
                    onChange={(event) => setCreateLongitude(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    placeholder="18.232266"
                    required
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCreateLatitude(point.latitude.toFixed(6));
                  setCreateLongitude(point.longitude.toFixed(6));
                }}
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Use current map center coordinates
              </button>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
                <textarea
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  className="min-h-[96px] w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  placeholder="Helpful details for students"
                />
              </div>

              {createError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{createError}</p>
              ) : null}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSpot}
                  className="inline-flex items-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isCreatingSpot ? 'Creating...' : 'Create location'}
                </button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </main>
  );
}

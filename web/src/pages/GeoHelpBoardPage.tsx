import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
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
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { PlatformTopNav } from '../components/PlatformTopNav';
import Button from '../components/Button';
import { getAccessToken, getRoleFromAccessToken, getUserIdFromAccessToken } from '../lib/auth';
import {
  createGeoHelpSpot,
  deactivateGeoHelpSpot,
  listNearbyGeoHelpSpots,
  listPopularGeoHelpSpots,
  recordGeoHelpSpotVisit,
  type GeoHelpSpot,
  type GeoHelpSpotCategory,
  type GeoHelpSpotReviewStatus,
  type GeoHelpSpotSection,
} from '../api/geo-help-board.api';

type ResourceTab = 'OFFICIAL' | 'COMMUNITY';
type CategoryFilter = 'ALL' | GeoHelpSpotCategory;
type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'insecure' | 'error';

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

const GEO_HELP_BOARD_TAB_STORAGE_KEY = 'geo-help-board-active-tab';
const GEO_HELP_BOARD_CITY_STORAGE_KEY = 'geo-help-board-city-filter';
const GEO_HELP_BOARD_RADIUS_STORAGE_KEY = 'geo-help-board-radius-km';
const GEO_HELP_BOARD_CATEGORY_STORAGE_KEY = 'geo-help-board-category-filter';

const reverseGeocodeCache = new Map<string, { label: string; city?: string }>();
const searchGeocodeCache = new Map<string, { label: string; city?: string; latitude: number; longitude: number }>();

const TAB_SECTION_MAP: Record<ResourceTab, GeoHelpSpotSection> = {
  OFFICIAL: 'OFFICIAL_RESOURCE',
  COMMUNITY: 'COMMUNITY_PICK',
};

const OFFICIAL_CATEGORY_OPTIONS: Array<{ value: GeoHelpSpotCategory; label: string }> = [
  { value: 'UNIVERSITY_SERVICE', label: 'University Service' },
  { value: 'ACADEMIC_DEPARTMENT', label: 'Academic Department' },
  { value: 'ADMIN_OFFICE', label: 'Administrative Office' },
  { value: 'STUDENT_SUPPORT', label: 'Student Support' },
  { value: 'CAMPUS_FACILITY', label: 'Campus Facility' },
  { value: 'OTHER', label: 'Other' },
];

const COMMUNITY_CATEGORY_OPTIONS: Array<{ value: GeoHelpSpotCategory; label: string }> = [
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'CAFE', label: 'Cafe' },
  { value: 'STUDY_SPOT', label: 'Study Spot' },
  { value: 'SOCIAL_HANGOUT', label: 'Social Hangout' },
  { value: 'FITNESS_WELLNESS', label: 'Fitness & Wellness' },
  { value: 'SHOPPING', label: 'Shopping' },
  { value: 'OTHER', label: 'Other' },
];

const CATEGORY_LABELS: Record<GeoHelpSpotCategory, string> = {
  UNIVERSITY_SERVICE: 'University Service',
  ACADEMIC_DEPARTMENT: 'Academic Department',
  ADMIN_OFFICE: 'Administrative Office',
  STUDENT_SUPPORT: 'Student Support',
  CAMPUS_FACILITY: 'Campus Facility',
  RESTAURANT: 'Restaurant',
  CAFE: 'Cafe',
  STUDY_SPOT: 'Study Spot',
  SOCIAL_HANGOUT: 'Social Hangout',
  FITNESS_WELLNESS: 'Fitness & Wellness',
  SHOPPING: 'Shopping',
  OTHER: 'Other',
};

function categoryLabel(value: GeoHelpSpotCategory): string {
  return CATEGORY_LABELS[value] ?? 'Other';
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

function formatDistance(distanceKm?: number): string {
  if (typeof distanceKm !== 'number' || Number.isNaN(distanceKm)) {
    return 'Distance unavailable';
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }

  return `${distanceKm.toFixed(1)} km away`;
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

function toCoordKey(point: Point): string {
  return `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`;
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

async function searchLocation(query: string): Promise<{ label: string; city?: string; latitude: number; longitude: number }> {
  const normalizedQuery = query.trim();
  const cached = searchGeocodeCache.get(normalizedQuery.toLowerCase());
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    q: normalizedQuery,
    addressdetails: '1',
    limit: '1',
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      'Accept-Language': 'en',
    },
  });

  if (!response.ok) {
    throw new Error('Location search failed.');
  }

  const results = (await response.json()) as Array<{
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
  }>;

  const first = results[0];
  if (!first?.lat || !first?.lon) {
    throw new Error('No matching location was found.');
  }

  const city =
    first.address?.city ??
    first.address?.town ??
    first.address?.village ??
    first.address?.municipality ??
    first.address?.county;

  const resolved = {
    label: first.display_name?.split(',').slice(0, 2).join(',').trim() ?? normalizedQuery,
    city,
    latitude: Number(first.lat),
    longitude: Number(first.lon),
  };

  searchGeocodeCache.set(normalizedQuery.toLowerCase(), resolved);
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
  const userRole = token ? getRoleFromAccessToken(token) : null;
  const userId = token ? getUserIdFromAccessToken(token) : null;

  const [activeTab, setActiveTab] = useState<ResourceTab>(() => {
    const saved = window.localStorage.getItem(GEO_HELP_BOARD_TAB_STORAGE_KEY);
    return saved === 'COMMUNITY' ? 'COMMUNITY' : 'OFFICIAL';
  });
  const [category, setCategory] = useState<CategoryFilter>(() => {
    const saved = window.localStorage.getItem(GEO_HELP_BOARD_CATEGORY_STORAGE_KEY);
    return saved === 'ALL' || saved === 'UNIVERSITY_SERVICE' || saved === 'ACADEMIC_DEPARTMENT' || saved === 'ADMIN_OFFICE' || saved === 'STUDENT_SUPPORT' || saved === 'CAMPUS_FACILITY' || saved === 'RESTAURANT' || saved === 'CAFE' || saved === 'STUDY_SPOT' || saved === 'SOCIAL_HANGOUT' || saved === 'FITNESS_WELLNESS' || saved === 'SHOPPING' || saved === 'OTHER'
      ? (saved as CategoryFilter)
      : 'ALL';
  });
  const [radiusKm, setRadiusKm] = useState(() => {
    const saved = Number(window.localStorage.getItem(GEO_HELP_BOARD_RADIUS_STORAGE_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : 5;
  });
  const [searchText, setSearchText] = useState('');
  const [cityFilter, setCityFilter] = useState(() => window.localStorage.getItem(GEO_HELP_BOARD_CITY_STORAGE_KEY) ?? DEFAULT_LOCATION.city);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationLabel, setLocationLabel] = useState(DEFAULT_LOCATION.label);
  const [locationNote, setLocationNote] = useState('');
  const [locationAccuracyM, setLocationAccuracyM] = useState<number | null>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [point, setPoint] = useState<Point>({
    latitude: DEFAULT_LOCATION.latitude,
    longitude: DEFAULT_LOCATION.longitude,
  });

  const [spots, setSpots] = useState<GeoHelpSpot[]>([]);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workingSpotId, setWorkingSpotId] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(15);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestCategory, setSuggestCategory] = useState<GeoHelpSpotCategory>('UNIVERSITY_SERVICE');
  const [suggestAddress, setSuggestAddress] = useState('');
  const [suggestDescription, setSuggestDescription] = useState('');
  const [suggestLatitude, setSuggestLatitude] = useState(String(DEFAULT_LOCATION.latitude));
  const [suggestLongitude, setSuggestLongitude] = useState(String(DEFAULT_LOCATION.longitude));
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);

  const visitedOnOpenRef = useRef<Set<string>>(new Set());
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const currentSection = TAB_SECTION_MAP[activeTab];
  const categoryOptions = activeTab === 'OFFICIAL' ? OFFICIAL_CATEGORY_OPTIONS : COMMUNITY_CATEGORY_OPTIONS;
  const apiCategory = category === 'ALL' ? undefined : category;

  useEffect(() => {
    setCategory('ALL');
    const defaultCategory = (activeTab === 'OFFICIAL' ? OFFICIAL_CATEGORY_OPTIONS : COMMUNITY_CATEGORY_OPTIONS)[0].value;
    setSuggestCategory(defaultCategory);
  }, [activeTab]);

  useEffect(() => {
    window.localStorage.setItem(GEO_HELP_BOARD_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    window.localStorage.setItem(GEO_HELP_BOARD_CATEGORY_STORAGE_KEY, category);
  }, [category]);

  useEffect(() => {
    window.localStorage.setItem(GEO_HELP_BOARD_CITY_STORAGE_KEY, cityFilter);
  }, [cityFilter]);

  useEffect(() => {
    window.localStorage.setItem(GEO_HELP_BOARD_RADIUS_STORAGE_KEY, String(radiusKm));
  }, [radiusKm]);

  useEffect(() => {
    if (!noticeMessage) {
      return;
    }

    const timer = window.setTimeout(() => setNoticeMessage(''), 3200);
    return () => window.clearTimeout(timer);
  }, [noticeMessage]);

  useEffect(() => {
    void handleRefresh();
    // Keep the visible board fresh so moderator approvals appear without a manual reload.
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void handleRefresh();
      }
    }, 20_000);

    const onFocus = () => {
      void handleRefresh();
    };

    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [activeTab, category, cityFilter, radiusKm]);

  useEffect(() => {
    const shouldLockScroll = isDrawerOpen || isSuggestModalOpen;
    if (!shouldLockScroll) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDrawerOpen, isSuggestModalOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadSpots() {
      try {
        setErrorMessage('');
        setIsLoading(true);

        const nearby = activeTab === 'OFFICIAL'
          ? await listNearbyGeoHelpSpots({
              latitude: point.latitude,
              longitude: point.longitude,
              radiusKm,
              city: cityFilter.trim() || undefined,
              section: currentSection,
              category: apiCategory,
              limit: 30,
              page: 1,
            })
          : await listPopularGeoHelpSpots({
              city: cityFilter.trim() || undefined,
              section: currentSection,
              category: apiCategory,
              limit: 30,
              page: 1,
            });

        if (!cancelled) {
          setSpots(nearby);
        }
      } catch (loadError) {
        if (!cancelled) {
          setErrorMessage(loadError instanceof Error ? loadError.message : 'Unable to load geo-board resources.');
          setSpots([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSpots();

    return () => {
      cancelled = true;
    };
  }, [activeTab, apiCategory, cityFilter, currentSection, point.latitude, point.longitude, radiusKm]);

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

  const selectedSpot =
    filteredSpots.find((spot) => spot.id === selectedSpotId) ??
    filteredSpots[0] ??
    null;

  const mapCenterPoint: Point = selectedSpot
    ? { latitude: selectedSpot.latitude, longitude: selectedSpot.longitude }
    : point;

  const mapCenter: [number, number] = [mapCenterPoint.latitude, mapCenterPoint.longitude];
  const mapClusters = useMemo(() => clusterSpots(filteredSpots, mapZoom), [filteredSpots, mapZoom]);
  const mapPoints = useMemo<Array<[number, number]>>(
    () => filteredSpots.map((spot) => [spot.latitude, spot.longitude]),
    [filteredSpots],
  );

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
    try {
      setIsRefreshing(true);
      setErrorMessage('');

      const refreshed = activeTab === 'OFFICIAL'
        ? await listNearbyGeoHelpSpots({
            latitude: point.latitude,
            longitude: point.longitude,
            radiusKm,
            city: cityFilter.trim() || undefined,
            section: currentSection,
            category: apiCategory,
            limit: 30,
            page: 1,
          })
        : await listPopularGeoHelpSpots({
            city: cityFilter.trim() || undefined,
            section: currentSection,
            category: apiCategory,
            limit: 30,
            page: 1,
          });

      setSpots(refreshed);
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

      const result = await searchLocation(query);
      const nextPoint = {
        latitude: result.latitude,
        longitude: result.longitude,
      };

      setPoint(nextPoint);
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

  function canDeleteSpot(spot: GeoHelpSpot): boolean {
    if (userRole === 'ADMIN' || userRole === 'STUDENT') {
      return true;
    }

    return Boolean(userId && spot.createdById === userId);
  }

  async function handleDeleteSpot(spotId: string) {
    const confirmed = window.confirm('Delete this place? This action hides it from all users.');
    if (!confirmed) {
      return;
    }

    try {
      setWorkingSpotId(spotId);
      setErrorMessage('');
      await deactivateGeoHelpSpot(spotId);
      setSpots((prev) => prev.filter((spot) => spot.id !== spotId));
      if (selectedSpotId === spotId) {
        setIsDrawerOpen(false);
        setSelectedSpotId(null);
      }
      setNoticeMessage('Location deleted successfully.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete the location.');
    } finally {
      setWorkingSpotId(null);
    }
  }

  async function handleSubmitSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = suggestTitle.trim();
    const latitude = Number(suggestLatitude);
    const longitude = Number(suggestLongitude);

    if (!title) {
      setErrorMessage('Place name is required.');
      return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setErrorMessage('Latitude and longitude must be valid numbers.');
      return;
    }

    try {
      setIsSubmittingSuggestion(true);
      setErrorMessage('');

      await createGeoHelpSpot({
        title,
        description: suggestDescription.trim() || undefined,
        city: cityFilter.trim() || DEFAULT_LOCATION.city,
        address: suggestAddress.trim() || undefined,
        latitude,
        longitude,
        section: currentSection,
        category: suggestCategory,
      });

      setSuggestTitle('');
      setSuggestAddress('');
      setSuggestDescription('');
      setSuggestLatitude(String(point.latitude));
      setSuggestLongitude(String(point.longitude));
      setIsSuggestModalOpen(false);
      setNoticeMessage('Suggestion sent for admin review.');
      await handleRefresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit suggestion.');
    } finally {
      setIsSubmittingSuggestion(false);
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
              Browse official university resources and student-loved community picks around campus.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSuggestLatitude(String(mapCenterPoint.latitude));
                setSuggestLongitude(String(mapCenterPoint.longitude));
                setIsSuggestModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50"
            >
              Suggest a Place
            </button>
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
        </div>

        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-start gap-3">
              <div className="mt-1 rounded-lg bg-sky-100 p-2 text-sky-700">
                <LocateFixed size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your Location</p>
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
              Update location
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
              placeholder="Refine location with an address or place name"
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

        {errorMessage ? (
          <section className="mb-4 inline-flex w-full items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            <AlertTriangle size={16} />
            {errorMessage}
          </section>
        ) : null}

        {noticeMessage ? (
          <section className="mb-4 inline-flex w-full items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {noticeMessage}
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
              center={[point.latitude, point.longitude]}
              radius={locationAccuracyM ?? Math.max(80, radiusKm * 120)}
              pathOptions={{ color: '#0ea5e9', fillColor: '#38bdf8', fillOpacity: 0.1 }}
            />

            <CircleMarker
              center={[point.latitude, point.longitude]}
              radius={8}
              pathOptions={{ color: '#0284c7', fillColor: '#0284c7', fillOpacity: 0.9 }}
            >
              <Popup>Your current center point</Popup>
            </CircleMarker>

            <MapResourceMarkers clusters={mapClusters} selectedSpotId={selectedSpotId} onSelectSpot={selectSpot} />
          </MapContainer>
        </section>

        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('OFFICIAL')}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                activeTab === 'OFFICIAL'
                  ? 'border-sky-300 bg-sky-100 text-sky-800'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'
              }`}
            >
              Official Resources
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('COMMUNITY')}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                activeTab === 'COMMUNITY'
                  ? 'border-sky-300 bg-sky-100 text-sky-800'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'
              }`}
            >
              Community Picks
            </button>

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
            <button
              type="button"
              onClick={() => setCategory('ALL')}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                category === 'ALL'
                  ? 'border-sky-300 bg-sky-100 text-sky-800'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'
              }`}
            >
              All
            </button>
            {categoryOptions.map((item) => (
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
                      {canDeleteSpot(spot) ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeleteSpot(spot.id);
                          }}
                          disabled={workingSpotId === spot.id}
                          className="inline-flex items-center rounded-lg border border-rose-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {workingSpotId === spot.id ? 'Deleting...' : 'Delete'}
                        </button>
                      ) : null}
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
            className="fixed inset-0 z-[1200] bg-slate-900/35"
          />
          <aside className="fixed right-0 top-0 z-[1210] h-full w-full max-w-md overflow-auto border-l border-slate-200 bg-white p-5 shadow-2xl max-sm:top-auto max-sm:bottom-0 max-sm:h-[85vh] max-sm:max-w-none max-sm:rounded-t-3xl max-sm:border-l-0 max-sm:border-t max-sm:p-4">
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
              {canDeleteSpot(selectedSpot) ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleDeleteSpot(selectedSpot.id);
                  }}
                  disabled={workingSpotId === selectedSpot.id}
                  className="inline-flex items-center rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {workingSpotId === selectedSpot.id ? 'Deleting...' : 'Delete place'}
                </button>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}

      {isSuggestModalOpen ? (
        <>
          <button
            type="button"
            aria-label="Close suggest place dialog"
            onClick={() => setIsSuggestModalOpen(false)}
            className="fixed inset-0 z-[1300] bg-slate-900/45"
          />
          <aside className="fixed left-1/2 top-1/2 z-[1310] max-h-[90vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl max-sm:max-w-[95vw]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggest a place</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                  {activeTab === 'OFFICIAL' ? 'Suggest Official Resource' : 'Suggest Community Pick'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">Your suggestion will go to admins for review before appearing publicly.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSuggestModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form className="mt-4 grid gap-3" onSubmit={(event) => void handleSubmitSuggestion(event)}>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Place name
                <input
                  value={suggestTitle}
                  onChange={(event) => setSuggestTitle(event.target.value)}
                  placeholder="e.g. Registrar Office, Faculty of Engineering, or Quiet Bean Cafe"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  required
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Category tag
                <select
                  value={suggestCategory}
                  onChange={(event) => setSuggestCategory(event.target.value as GeoHelpSpotCategory)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                >
                  {categoryOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Address / location note
                <input
                  value={suggestAddress}
                  onChange={(event) => setSuggestAddress(event.target.value)}
                  placeholder="Street, building, floor, or landmark"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Why should students visit this place? (optional)
                <textarea
                  value={suggestDescription}
                  onChange={(event) => setSuggestDescription(event.target.value)}
                  rows={3}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                />
              </label>

              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Latitude
                  <input
                    value={suggestLatitude}
                    onChange={(event) => setSuggestLatitude(event.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Longitude
                  <input
                    value={suggestLongitude}
                    onChange={(event) => setSuggestLongitude(event.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  />
                </label>
              </div>

              <p className="text-xs text-slate-500">
                Tip: coordinates are prefilled from your current map center so others can open directions directly.
              </p>

              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSuggestModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSuggestion}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmittingSuggestion ? 'Submitting...' : 'Submit for review'}
                </button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </main>
  );
}

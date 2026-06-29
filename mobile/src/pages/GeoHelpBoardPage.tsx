import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faCompass,
  faCrosshairs,
  faLocationDot,
  faMagnifyingGlass,
  faPlus,
  faPowerOff,
  faRotateRight,
  faRoute,
  faTrash,
  faX,
} from '@fortawesome/free-solid-svg-icons';
import MapView, { Marker, type LongPressEvent, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { MobileBottomNav, type MobileNavTab } from '../components/MobileBottomNav';
import { clearTokens } from '../lib/auth-storage';
import { getValidAccessToken } from '../lib/auth-session';
import { getRoleFromAccessToken, getUserIdFromAccessToken, type UserRole } from '../lib/jwt';
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
import type { RootStackParamList } from '../navigation/root-stack';
import { useTheme } from '../theme/theme';
import { StatusBar } from 'expo-status-bar';

type Props = NativeStackScreenProps<RootStackParamList, 'GeoHelpBoard'>;
type ResourceTab = 'OFFICIAL' | 'COMMUNITY';
type CategoryFilter = 'ALL' | GeoHelpSpotCategory;

interface Point {
  latitude: number;
  longitude: number;
}

const DEFAULT_POINT: Point = {
  latitude: 46.072734,
  longitude: 18.232266,
};

const DEFAULT_LOCATION_LABEL = 'Pecs, Hungary';

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

function reviewBadgeStyles(reviewStatus: GeoHelpSpotReviewStatus): { backgroundColor: string; textColor: string } {
  if (reviewStatus === 'VERIFIED') {
    return { backgroundColor: '#dcfce7', textColor: '#166534' };
  }

  if (reviewStatus === 'REJECTED') {
    return { backgroundColor: '#fee2e2', textColor: '#991b1b' };
  }

  return { backgroundColor: '#fef3c7', textColor: '#92400e' };
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

function sanitizeRadius(value: string): number {
  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) {
    return 5;
  }

  return Math.min(Math.max(next, 0.5), 25);
}

function toMapUrl(point: Point): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point.latitude},${point.longitude}`)}`;
}

function toDirectionsUrl(from: Point, to: Point): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${from.latitude},${from.longitude}`)}&destination=${encodeURIComponent(`${to.latitude},${to.longitude}`)}&travelmode=driving`;
}

function formatPlaceLabel(reverseGeocodeResult?: Location.LocationGeocodedAddress | null): string {
  if (!reverseGeocodeResult) {
    return DEFAULT_LOCATION_LABEL;
  }

  const city = reverseGeocodeResult.city ?? reverseGeocodeResult.subregion ?? reverseGeocodeResult.region;
  const country = reverseGeocodeResult.country ?? '';

  if (city && country) {
    return `${city}, ${country}`;
  }

  if (city) {
    return city;
  }

  if (country) {
    return country;
  }

  return DEFAULT_LOCATION_LABEL;
}

async function reverseLookupLabel(point: Point): Promise<string> {
  try {
    const result = await Location.reverseGeocodeAsync(point);
    return formatPlaceLabel(result[0]);
  } catch {
    return DEFAULT_LOCATION_LABEL;
  }
}

export function GeoHelpBoardPage({ navigation }: Props) {
  const { tokens } = useTheme();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);

  const [activeTab, setActiveTab] = useState<ResourceTab>('OFFICIAL');
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [cityFilter, setCityFilter] = useState('');
  const [radiusInput, setRadiusInput] = useState('5');
  const [searchQuery, setSearchQuery] = useState('');

  const [point, setPoint] = useState<Point>(DEFAULT_POINT);
  const [locationLabel, setLocationLabel] = useState(DEFAULT_LOCATION_LABEL);
  const [locationQuery, setLocationQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);

  const [spots, setSpots] = useState<GeoHelpSpot[]>([]);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [workingSpotId, setWorkingSpotId] = useState<string | null>(null);

  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestDescription, setSuggestDescription] = useState('');
  const [suggestAddress, setSuggestAddress] = useState('');
  const [suggestCity, setSuggestCity] = useState('Pecs');
  const [suggestPoint, setSuggestPoint] = useState<Point>(DEFAULT_POINT);
  const [suggestPlaceLabel, setSuggestPlaceLabel] = useState(DEFAULT_LOCATION_LABEL);
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);

  const radiusKm = sanitizeRadius(radiusInput);
  const currentSection = TAB_SECTION_MAP[activeTab];
  const categoryOptions = activeTab === 'OFFICIAL' ? OFFICIAL_CATEGORY_OPTIONS : COMMUNITY_CATEGORY_OPTIONS;
  const apiCategory = category === 'ALL' ? undefined : category;
  const canAccessGeoHelpBoard = userRole !== null && userRole !== 'ALUMNI';

  const replaceToLogin = useCallback(() => {
    if (navigation) {
      navigation.replace('Login');
    }
  }, [navigation]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const token = await getValidAccessToken();
        if (cancelled) {
          return;
        }

        if (!token) {
          replaceToLogin();
          return;
        }

        setAccessToken(token);
        setUserRole(getRoleFromAccessToken(token));
        setUserId(getUserIdFromAccessToken(token));
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [replaceToLogin]);

  useEffect(() => {
    if (!noticeMessage) {
      return;
    }

    const timer = setTimeout(() => setNoticeMessage(''), 2600);
    return () => clearTimeout(timer);
  }, [noticeMessage]);

  useEffect(() => {
    const defaultCategory = categoryOptions[0]?.value ?? 'OTHER';
    if (category !== 'ALL' && !categoryOptions.some((option) => option.value === category)) {
      setCategory(defaultCategory);
    }
  }, [category, categoryOptions]);

  useEffect(() => {
    setSuggestPoint(point);
    setSuggestPlaceLabel(locationLabel);
    setSuggestCity(cityFilter.trim() || 'Pecs');
  }, [cityFilter, locationLabel, point]);

  const fetchSpotsWithFallback = useCallback(
    async (token: string): Promise<GeoHelpSpot[]> => {
      const city = cityFilter.trim() || undefined;

      if (activeTab === 'COMMUNITY') {
        return listPopularGeoHelpSpots(token, {
          city,
          section: currentSection,
          category: apiCategory,
          limit: 40,
        });
      }

      const nearby = await listNearbyGeoHelpSpots(token, {
        latitude: point.latitude,
        longitude: point.longitude,
        radiusKm,
        city,
        section: currentSection,
        category: apiCategory,
        limit: 40,
      });

      if (nearby.length > 0) {
        return nearby;
      }

      return listPopularGeoHelpSpots(token, {
        city,
        section: currentSection,
        category: apiCategory,
        limit: 40,
      });
    },
    [activeTab, apiCategory, cityFilter, currentSection, point.latitude, point.longitude, radiusKm],
  );

  const loadSpots = useCallback(
    async (showRefreshState: boolean) => {
      if (!accessToken || !canAccessGeoHelpBoard) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        setErrorMessage('');
        if (showRefreshState) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const nextSpots = await fetchSpotsWithFallback(accessToken);
        setSpots(nextSpots);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load geo resources.');
        setSpots([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [accessToken, canAccessGeoHelpBoard, fetchSpotsWithFallback],
  );

  useEffect(() => {
    if (!isBooting) {
      void loadSpots(false);
    }
  }, [isBooting, loadSpots]);

  const handleRefresh = useCallback(async () => {
    await loadSpots(true);
  }, [loadSpots]);

  const handleUseCurrentLocation = useCallback(async () => {
    try {
      setIsLocating(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setNoticeMessage('Location permission is required to use GPS.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextPoint = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setPoint(nextPoint);

      const label = await reverseLookupLabel(nextPoint);
      setLocationLabel(label);
      setSuggestPlaceLabel(label);
      setSuggestPoint(nextPoint);

      const cityResult = await Location.reverseGeocodeAsync(nextPoint);
      const resolvedCity = cityResult[0]?.city ?? cityResult[0]?.subregion ?? '';
      if (resolvedCity) {
        setSuggestCity(resolvedCity);
      }

      setNoticeMessage('Location updated from your phone GPS.');
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : 'Unable to get your current location.');
    } finally {
      setIsLocating(false);
    }
  }, []);

  const handleFindLocation = useCallback(async () => {
    if (!locationQuery.trim()) {
      setNoticeMessage('Enter a city or address first.');
      return;
    }

    try {
      setIsResolvingLocation(true);
      const geocode = await Location.geocodeAsync(locationQuery.trim());
      const first = geocode[0];
      if (!first) {
        setNoticeMessage('No matching location found. Try a more specific address.');
        return;
      }

      const nextPoint = { latitude: first.latitude, longitude: first.longitude };
      setPoint(nextPoint);
      const label = await reverseLookupLabel(nextPoint);
      setLocationLabel(label);
      setSuggestPoint(nextPoint);
      setSuggestPlaceLabel(label);

      const reverse = await Location.reverseGeocodeAsync(nextPoint);
      const resolvedCity = reverse[0]?.city ?? reverse[0]?.subregion ?? '';
      if (resolvedCity) {
        setCityFilter(resolvedCity);
        setSuggestCity(resolvedCity);
      }

      setNoticeMessage('Search area updated.');
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : 'Unable to find that location.');
    } finally {
      setIsResolvingLocation(false);
    }
  }, [locationQuery]);

  const handleMapLongPress = useCallback(async (event: LongPressEvent) => {
    const nextPoint = event.nativeEvent.coordinate;
    setPoint(nextPoint);

    const label = await reverseLookupLabel(nextPoint);
    setLocationLabel(label);
    setNoticeMessage('Search area moved on map.');

    const reverse = await Location.reverseGeocodeAsync(nextPoint);
    const resolvedCity = reverse[0]?.city ?? reverse[0]?.subregion ?? '';
    if (resolvedCity) {
      setCityFilter(resolvedCity);
      setSuggestCity(resolvedCity);
    }
  }, []);

  const handleOpenSpot = useCallback(
    async (spot: GeoHelpSpot) => {
      if (!accessToken) {
        return;
      }

      try {
        await recordGeoHelpSpotVisit(accessToken, spot.id);
        const url = toMapUrl({ latitude: spot.latitude, longitude: spot.longitude });
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          throw new Error('No map app is available for this action.');
        }

        await Linking.openURL(url);
      } catch (error) {
        setNoticeMessage(error instanceof Error ? error.message : 'Failed to open location.');
      }
    },
    [accessToken],
  );

  const handleOpenDirections = useCallback(
    async (spot: GeoHelpSpot) => {
      try {
        const url = toDirectionsUrl(point, { latitude: spot.latitude, longitude: spot.longitude });
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          throw new Error('No maps app is available for directions.');
        }

        await Linking.openURL(url);
      } catch (error) {
        setNoticeMessage(error instanceof Error ? error.message : 'Failed to open directions.');
      }
    },
    [point],
  );

  const handleDeactivate = useCallback(
    async (spot: GeoHelpSpot) => {
      if (!accessToken) {
        return;
      }

      try {
        setWorkingSpotId(spot.id);
        await deactivateGeoHelpSpot(accessToken, spot.id);
        setNoticeMessage('Location deleted successfully.');
        await loadSpots(true);
      } catch (error) {
        setNoticeMessage(error instanceof Error ? error.message : 'Failed to delete location.');
      } finally {
        setWorkingSpotId(null);
      }
    },
    [accessToken, loadSpots],
  );

  const handleSubmitSuggestion = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    if (!suggestTitle.trim() || !suggestCity.trim()) {
      setNoticeMessage('Title and city are required.');
      return;
    }

    try {
      setIsSubmittingSuggestion(true);
      await createGeoHelpSpot(accessToken, {
        title: suggestTitle.trim(),
        description: suggestDescription.trim() || undefined,
        city: suggestCity.trim(),
        address: suggestAddress.trim() || undefined,
        latitude: suggestPoint.latitude,
        longitude: suggestPoint.longitude,
        section: currentSection,
        category: category === 'ALL' ? categoryOptions[0].value : category,
      });

      setSuggestTitle('');
      setSuggestDescription('');
      setSuggestAddress('');
      setShowSuggestModal(false);
      setNoticeMessage('Place submitted for admin review.');
      await loadSpots(true);
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : 'Failed to submit location.');
    } finally {
      setIsSubmittingSuggestion(false);
    }
  }, [
    accessToken,
    category,
    categoryOptions,
    currentSection,
    loadSpots,
    suggestAddress,
    suggestCity,
    suggestDescription,
    suggestPoint.latitude,
    suggestPoint.longitude,
    suggestTitle,
  ]);

  const handleUseCurrentLocationForSuggestion = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setNoticeMessage('Location permission is required to set suggestion coordinates.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextPoint = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };

      setSuggestPoint(nextPoint);
      const label = await reverseLookupLabel(nextPoint);
      setSuggestPlaceLabel(label);
      setNoticeMessage('Suggestion pin moved to your current location.');
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : 'Unable to get current location.');
    }
  }, []);

  const handleResolveSuggestionLocation = useCallback(async () => {
    const query = [suggestAddress.trim(), suggestCity.trim()].filter(Boolean).join(', ');

    if (!query) {
      return;
    }

    try {
      const geocode = await Location.geocodeAsync(query);
      const first = geocode[0];

      if (!first) {
        setNoticeMessage('No matching suggestion location found. Try a more specific address.');
        return;
      }

      const nextPoint = { latitude: first.latitude, longitude: first.longitude };
      setSuggestPoint(nextPoint);

      const label = await reverseLookupLabel(nextPoint);
      setSuggestPlaceLabel(label);

      const reverse = await Location.reverseGeocodeAsync(nextPoint);
      const resolvedCity = reverse[0]?.city ?? reverse[0]?.subregion ?? '';
      if (resolvedCity) {
        setSuggestCity(resolvedCity);
      }

      setNoticeMessage('Suggestion pin moved to the entered location.');
    } catch (error) {
      setNoticeMessage(error instanceof Error ? error.message : 'Unable to find that suggestion location.');
    }
  }, [suggestAddress, suggestCity]);

  const handleNavigateBottom = useCallback(
    (tab: MobileNavTab) => {
      if (!navigation) {
        return;
      }

      if (tab === 'home') {
        navigation.navigate('Dashboard');
        return;
      }

      if (tab === 'discussions') {
        navigation.navigate('Discussions');
        return;
      }

      if (tab === 'study-groups') {
        navigation.navigate('StudyGroups');
        return;
      }

      if (tab === 'notes') {
        setNoticeMessage('Notes will be added in the next mobile update.');
      }
    },
    [navigation],
  );

  const handleLogout = useCallback(async () => {
    await clearTokens();
    replaceToLogin();
  }, [replaceToLogin]);

  const visibleSpots = useMemo(() => spots.filter((spot) => spot.isActive), [spots]);

  const filteredSpots = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return visibleSpots;
    }

    return visibleSpots.filter((spot) => {
      return (
        spot.title.toLowerCase().includes(query) ||
        (spot.description?.toLowerCase().includes(query) ?? false) ||
        spot.city.toLowerCase().includes(query) ||
        (spot.address?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [searchQuery, visibleSpots]);

  const selectedSpot = useMemo(
    () => filteredSpots.find((spot) => spot.id === selectedSpotId) ?? filteredSpots[0] ?? null,
    [filteredSpots, selectedSpotId],
  );

  useEffect(() => {
    if (filteredSpots.length === 0) {
      setSelectedSpotId(null);
      return;
    }

    if (!selectedSpotId || !filteredSpots.some((spot) => spot.id === selectedSpotId)) {
      setSelectedSpotId(filteredSpots[0].id);
    }
  }, [filteredSpots, selectedSpotId]);

  const mapRegion: Region = useMemo(() => {
    const center = selectedSpot
      ? { latitude: selectedSpot.latitude, longitude: selectedSpot.longitude }
      : point;

    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [point, selectedSpot]);

  if (isBooting || userRole === null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={tokens.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!accessToken) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ textAlign: 'center', fontSize: 16, color: tokens.muted }}>Session expired. Please log in again.</Text>
          <Pressable onPress={replaceToLogin} style={{ marginTop: 16, borderRadius: 12, backgroundColor: tokens.primary, paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: 'white' }}>Go to Login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!canAccessGeoHelpBoard) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
        <StatusBar style={tokens.name === 'midnight' ? 'light' : 'dark'} />
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: tokens.danger }}>Access Denied</Text>
            <Text style={{ marginTop: 12, fontSize: 15, lineHeight: 24, color: tokens.muted, textAlign: 'center' }}>
              This page is available to students, professors, and admins.
            </Text>
            <Pressable onPress={() => navigation?.navigate('Dashboard')} style={{ marginTop: 20, borderRadius: 12, backgroundColor: tokens.primary, paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: '700', color: 'white' }}>Back to Dashboard</Text>
            </Pressable>
          </View>

          <MobileBottomNav activeTab="geo-board" onNavigate={handleNavigateBottom} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
      <StatusBar style={tokens.name === 'midnight' ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {noticeMessage ? (
            <View style={{ marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.accentSoft, paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.accent }}>{noticeMessage}</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View style={{ marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.name === 'midnight' ? '#3a1a1e' : '#ffe8e8', paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.danger }}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={{ marginBottom: 12, borderRadius: 24, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 16, paddingVertical: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: tokens.text }}>Geo Board</Text>
                <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: tokens.muted }}>
                  Explore campus resources and local picks on the live map.
                </Text>
              </View>

              <Pressable onPress={() => void handleLogout()} style={{ height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: tokens.primarySoft }}>
                <FontAwesomeIcon icon={faPowerOff as IconProp} size={16} color={tokens.primary} />
              </Pressable>
            </View>

            <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
              {(['OFFICIAL', 'COMMUNITY'] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <Pressable
                    key={tab}
                    onPress={() => {
                      setActiveTab(tab);
                      setCategory('ALL');
                    }}
                    style={{
                      flex: 1, borderRadius: 12, paddingVertical: 10,
                      backgroundColor: isActive ? tokens.primary : tokens.primarySoft
                    }}
                  >
                    <Text style={{ textAlign: 'center', fontSize: 12, fontWeight: '700', color: isActive ? 'white' : tokens.primary }}>
                      {tab === 'OFFICIAL' ? 'Official Resources' : 'Community Picks'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ marginBottom: 12, borderRadius: 20, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.primary, padding: 16 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(255,255,255,0.7)' }}>Current Search Area</Text>
            <Text style={{ marginTop: 6, fontSize: 18, fontWeight: '800', color: 'white' }}>{locationLabel}</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>Spots are ranked around this location.</Text>

            <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => void handleUseCurrentLocation()}
                disabled={isLocating}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, paddingVertical: 10, backgroundColor: isLocating ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.2)' }}
              >
                <FontAwesomeIcon icon={faCrosshairs as IconProp} size={13} color="white" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: 'white' }}>{isLocating ? 'Locating...' : 'Use My GPS'}</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowSuggestModal(true)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <FontAwesomeIcon icon={faPlus as IconProp} size={13} color="white" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: 'white' }}>Suggest</Text>
              </Pressable>
            </View>

            <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={locationQuery}
                onChangeText={setLocationQuery}
                placeholder="Search city or address"
                style={{ flex: 1, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: 'white' }}
                placeholderTextColor="rgba(255,255,255,0.6)"
              />
              <Pressable
                onPress={() => void handleFindLocation()}
                disabled={isResolvingLocation}
                style={{ height: 38, width: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: isResolvingLocation ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.2)' }}
              >
                <FontAwesomeIcon icon={faMagnifyingGlass as IconProp} size={13} color="white" />
              </Pressable>
            </View>
          </View>

          <View style={{ marginBottom: 12, overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}>
            <View style={{ paddingHorizontal: 16, paddingBottom: 8, paddingTop: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.text }}>Live Map</Text>
              <Text style={{ marginTop: 2, fontSize: 12, color: tokens.muted }}>Long-press on map to move your search area.</Text>
            </View>

            <View style={{ height: 270 }}>
              <MapView
                style={{ flex: 1 }}
                region={mapRegion}
                onLongPress={(event) => void handleMapLongPress(event)}
                showsUserLocation
                showsMyLocationButton
                loadingEnabled
              >
                <Marker coordinate={point} title="Search area" pinColor="#ef4444" />

                {filteredSpots.map((spot) => (
                  <Marker
                    key={spot.id}
                    coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
                    title={spot.title}
                    description={spot.city}
                    pinColor={spot.section === 'OFFICIAL_RESOURCE' ? '#1d4ed8' : '#f59e0b'}
                    onPress={() => setSelectedSpotId(spot.id)}
                  />
                ))}
              </MapView>
            </View>
          </View>

          <View style={{ marginBottom: 12, borderRadius: 20, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 16 }}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by title, city, address..."
              style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tokens.text }}
              placeholderTextColor={tokens.muted}
            />

            <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={cityFilter}
                onChangeText={setCityFilter}
                placeholder="City filter"
                style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tokens.text }}
                placeholderTextColor={tokens.muted}
              />
              <TextInput
                value={radiusInput}
                onChangeText={setRadiusInput}
                keyboardType="decimal-pad"
                placeholder="Radius"
                style={{ width: 80, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tokens.text }}
                placeholderTextColor={tokens.muted}
              />
              <Pressable onPress={() => void handleRefresh()} style={{ height: 42, width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: tokens.primarySoft }}>
                <FontAwesomeIcon icon={faRotateRight as IconProp} size={14} color={tokens.primary} />
              </Pressable>
            </View>

            <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <FilterPill label="All" active={category === 'ALL'} onPress={() => setCategory('ALL')} tokens={tokens} />
              {categoryOptions.map((option) => (
                <FilterPill
                  key={option.value}
                  label={option.label}
                  active={category === option.value}
                  onPress={() => setCategory(option.value)}
                  tokens={tokens}
                />
              ))}
            </View>
          </View>

          {selectedSpot ? (
            <View style={{ marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.primarySoft, paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, color: tokens.primaryStrong }}>Selected Place</Text>
              <Text style={{ marginTop: 4, fontSize: 15, fontWeight: '800', color: tokens.text }}>{selectedSpot.title}</Text>
              <Text style={{ marginTop: 2, fontSize: 12, color: tokens.muted }}>{selectedSpot.address || selectedSpot.city}</Text>
            </View>
          ) : null}

          {isLoading ? (
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 16, paddingVertical: 32 }}>
              <ActivityIndicator size="large" color={tokens.primary} />
            </View>
          ) : filteredSpots.length === 0 ? (
            <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 16, paddingVertical: 32 }}>
              <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: '600', color: tokens.muted }}>No spots found with current filters.</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {filteredSpots.map((spot) => {
                const badge = reviewBadgeStyles(spot.reviewStatus);
                const canDelete = userRole === 'ADMIN' || userId === spot.createdById;
                const isBusy = workingSpotId === spot.id;
                const isSelected = selectedSpot?.id === spot.id;

                return (
                  <Pressable
                    key={spot.id}
                    onPress={() => setSelectedSpotId(spot.id)}
                    style={{
                      borderRadius: 16, borderWidth: 1,
                      borderColor: isSelected ? tokens.primary : tokens.border,
                      backgroundColor: isSelected ? tokens.primarySoft : tokens.surface,
                      padding: 16
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.text }}>{spot.title}</Text>
                        <Text style={{ marginTop: 4, fontSize: 12, color: tokens.muted }}>{categoryLabel(spot.category)} • {spot.city}</Text>
                      </View>

                      <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: badge.backgroundColor }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: badge.textColor }}>
                          {spot.reviewStatus}
                        </Text>
                      </View>
                    </View>

                    {spot.address ? (
                      <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <FontAwesomeIcon icon={faLocationDot as IconProp} size={12} color={tokens.muted} />
                        <Text style={{ flex: 1, fontSize: 13, color: tokens.text }}>{spot.address}</Text>
                      </View>
                    ) : null}

                    {spot.description ? <Text style={{ marginTop: 8, fontSize: 13, color: tokens.muted }}>{spot.description}</Text> : null}

                    <Text style={{ marginTop: 8, fontSize: 11, fontWeight: '600', color: tokens.muted }}>
                      {formatDistance(spot.distanceKm)} • {spot.visitCount} visits
                    </Text>

                    <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Pressable onPress={() => void handleOpenSpot(spot)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, backgroundColor: tokens.primarySoft, paddingHorizontal: 12, paddingVertical: 6 }}>
                        <FontAwesomeIcon icon={faCompass as IconProp} size={12} color={tokens.primary} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.primary }}>Open</Text>
                      </Pressable>

                      <Pressable onPress={() => void handleOpenDirections(spot)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, backgroundColor: tokens.name === 'midnight' ? '#0d2d1a' : '#ecfdf3', paddingHorizontal: 12, paddingVertical: 6 }}>
                        <FontAwesomeIcon icon={faRoute as IconProp} size={12} color="#15803d" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#15803d' }}>Directions</Text>
                      </Pressable>

                      {canDelete ? (
                        <Pressable
                          onPress={() => void handleDeactivate(spot)}
                          disabled={isBusy}
                          style={{
                            flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8,
                            backgroundColor: tokens.name === 'midnight' ? '#3a1a1e' : '#fee2e2',
                            paddingHorizontal: 12, paddingVertical: 6
                          }}
                        >
                          <FontAwesomeIcon icon={faTrash as IconProp} size={12} color={tokens.danger} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.danger }}>{isBusy ? 'Deleting...' : 'Delete'}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {isRefreshing ? (
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={tokens.primary} />
            </View>
          ) : null}
        </ScrollView>

        <Modal visible={showSuggestModal} transparent animationType="slide" onRequestClose={() => setShowSuggestModal(false)}>
          <View style={{ flex: 1, justifyContent: 'end' } as any}>
            <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => setShowSuggestModal(false)} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ maxHeight: '88%' }}>
              <View style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: tokens.surface, paddingHorizontal: 16, paddingBottom: 24, paddingTop: 16 }}>
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                  <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } as any}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: tokens.text }}>Suggest a New Place</Text>
                    <Pressable onPress={() => setShowSuggestModal(false)} style={{ height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: tokens.surfaceElevated }}>
                      <FontAwesomeIcon icon={faX as IconProp} size={13} color={tokens.muted} />
                    </Pressable>
                  </View>

                  <TextInput
                    value={suggestTitle}
                    onChangeText={setSuggestTitle}
                    placeholder="Title"
                    style={{ marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tokens.text }}
                    placeholderTextColor={tokens.muted}
                  />

                  <TextInput
                    value={suggestDescription}
                    onChangeText={setSuggestDescription}
                    placeholder="Description (optional)"
                    style={{ marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tokens.text }}
                    placeholderTextColor={tokens.muted}
                    multiline
                  />

                  <TextInput
                    value={suggestAddress}
                    onChangeText={setSuggestAddress}
                    placeholder="Address (optional)"
                    style={{ marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tokens.text }}
                    placeholderTextColor={tokens.muted}
                    returnKeyType="done"
                    onEndEditing={() => void handleResolveSuggestionLocation()}
                  />

                  <TextInput
                    value={suggestCity}
                    onChangeText={setSuggestCity}
                    placeholder="City"
                    style={{ marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tokens.text }}
                    placeholderTextColor={tokens.muted}
                    returnKeyType="done"
                    onEndEditing={() => void handleResolveSuggestionLocation()}
                  />

                  <View style={{ marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: tokens.muted }}>Suggestion Pin</Text>
                    <Text style={{ marginTop: 4, fontSize: 14, color: tokens.text }}>{suggestPlaceLabel}</Text>
                  </View>

                  <View style={{ marginBottom: 8, height: 160, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: tokens.border }}>
                    <MapView
                      style={{ flex: 1 }}
                      region={{
                        latitude: suggestPoint.latitude,
                        longitude: suggestPoint.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}
                      onLongPress={(event) => {
                        const nextPoint = event.nativeEvent.coordinate;
                        setSuggestPoint(nextPoint);
                        void reverseLookupLabel(nextPoint).then((label) => setSuggestPlaceLabel(label));
                      }}
                    >
                      <Marker coordinate={suggestPoint} title="Suggestion Pin" pinColor={tokens.primary} />
                    </MapView>
                  </View>

                  <Pressable onPress={() => void handleUseCurrentLocationForSuggestion()} style={{ marginBottom: 12, alignItems: 'center', borderRadius: 12, backgroundColor: tokens.primarySoft, paddingVertical: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.primary }}>Use my current location</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => void handleSubmitSuggestion()}
                    disabled={isSubmittingSuggestion}
                    style={{
                      alignItems: 'center', borderRadius: 12, paddingVertical: 12,
                      backgroundColor: isSubmittingSuggestion ? tokens.primarySoft : tokens.primary
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: 'white' }}>{isSubmittingSuggestion ? 'Submitting...' : 'Submit for review'}</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <View style={{ backgroundColor: tokens.surface }}>
          <MobileBottomNav activeTab="geo-board" onNavigate={handleNavigateBottom} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function FilterPill({ label, active, onPress, tokens }: { label: string; active: boolean; onPress: () => void; tokens: any }) {
  return (
    <Pressable onPress={onPress} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: active ? tokens.primary : tokens.primarySoft }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? 'white' : tokens.primary }}>{label}</Text>
    </Pressable>
  );
}

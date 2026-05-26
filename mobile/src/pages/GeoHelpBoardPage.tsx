import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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

export function GeoHelpBoardPage(props: Props) {
  const navigation = props?.navigation;

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
      <SafeAreaView className="flex-1 bg-[#f4f7ff]">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1d4ed8" />
        </View>
      </SafeAreaView>
    );
  }

  if (!accessToken) {
    return (
      <SafeAreaView className="flex-1 bg-[#f4f7ff]">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-[#3e5578]">Session expired. Please log in again.</Text>
          <Pressable onPress={replaceToLogin} className="mt-4 rounded-xl bg-[#1d4ed8] px-4 py-3">
            <Text className="text-sm font-bold text-white">Go to Login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!canAccessGeoHelpBoard) {
    return (
      <SafeAreaView className="flex-1 bg-[#f4f7ff]">
        <View className="flex-1 justify-between px-4 pb-2 pt-4">
          <View className="rounded-3xl border border-[#d7e1f2] bg-white p-5">
            <Text className="text-3xl font-extrabold tracking-[-0.03em] text-[#0f2244]">Geo Help Board</Text>
            <Text className="mt-3 text-[15px] leading-6 text-[#4c6487]">
              This page is available to students, professors, and admins.
            </Text>
            <Pressable onPress={() => navigation?.navigate('Dashboard')} className="mt-5 rounded-xl bg-[#1d4ed8] px-4 py-3">
              <Text className="text-center text-sm font-bold text-white">Back to Dashboard</Text>
            </Pressable>
          </View>

          <MobileBottomNav activeTab="geo-board" onNavigate={handleNavigateBottom} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f4f7ff]">
      <View className="flex-1">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {noticeMessage ? (
            <View className="mb-3 rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3">
              <Text className="text-sm font-semibold text-[#92400e]">{noticeMessage}</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View className="mb-3 rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3">
              <Text className="text-sm font-semibold text-[#991b1b]">{errorMessage}</Text>
            </View>
          ) : null}

          <View className="mb-3 rounded-[28px] border border-[#d6e1f3] bg-white px-4 py-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-2">
                <Text className="text-[30px] font-extrabold tracking-[-0.05em] text-[#0f2244]">Geo Board</Text>
                <Text className="mt-1 text-[15px] leading-6 text-[#4c6487]">
                  Explore campus resources and local picks on the live map.
                </Text>
              </View>

              <Pressable onPress={() => void handleLogout()} className="h-11 w-11 items-center justify-center rounded-full bg-[#eff6ff]">
                <FontAwesomeIcon icon={faPowerOff as IconProp} size={16} color="#1d4ed8" />
              </Pressable>
            </View>

            <View className="mt-4 flex-row gap-2">
              {(['OFFICIAL', 'COMMUNITY'] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <Pressable
                    key={tab}
                    onPress={() => {
                      setActiveTab(tab);
                      setCategory('ALL');
                    }}
                    className={`flex-1 rounded-2xl px-3 py-3 ${isActive ? 'bg-[#1d4ed8]' : 'bg-[#eef5ff]'}`}
                  >
                    <Text className={`text-center text-xs font-bold ${isActive ? 'text-white' : 'text-[#1f3a63]'}`}>
                      {tab === 'OFFICIAL' ? 'Official Resources' : 'Community Picks'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mb-3 rounded-[24px] border border-[#d6e1f3] bg-[#0f3b89] p-4">
            <Text className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">Current Search Area</Text>
            <Text className="mt-2 text-[19px] font-extrabold tracking-[-0.02em] text-white">{locationLabel}</Text>
            <Text className="mt-1 text-xs text-white/90">Spots are ranked around this location.</Text>

            <View className="mt-3 flex-row gap-2">
              <Pressable
                onPress={() => void handleUseCurrentLocation()}
                disabled={isLocating}
                className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl px-3 py-2.5 ${isLocating ? 'bg-white/30' : 'bg-white/20'}`}
              >
                <FontAwesomeIcon icon={faCrosshairs as IconProp} size={13} color="white" />
                <Text className="text-xs font-bold text-white">{isLocating ? 'Locating...' : 'Use My GPS'}</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowSuggestModal(true)}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-white/20 px-3 py-2.5"
              >
                <FontAwesomeIcon icon={faPlus as IconProp} size={13} color="white" />
                <Text className="text-xs font-bold text-white">Suggest</Text>
              </Pressable>
            </View>

            <View className="mt-3 flex-row gap-2">
              <TextInput
                value={locationQuery}
                onChangeText={setLocationQuery}
                placeholder="Search city or address"
                className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white"
                placeholderTextColor="rgba(255,255,255,0.7)"
              />
              <Pressable
                onPress={() => void handleFindLocation()}
                disabled={isResolvingLocation}
                className={`h-[42px] w-[42px] items-center justify-center rounded-xl ${isResolvingLocation ? 'bg-white/30' : 'bg-white/20'}`}
              >
                <FontAwesomeIcon icon={faMagnifyingGlass as IconProp} size={13} color="white" />
              </Pressable>
            </View>
          </View>

          <View className="mb-3 overflow-hidden rounded-[24px] border border-[#d6e1f3] bg-white">
            <View className="px-4 pb-2 pt-3">
              <Text className="text-base font-extrabold text-[#0f2244]">Live Map</Text>
              <Text className="mt-1 text-xs text-[#4e6385]">Long-press on map to move your search area.</Text>
            </View>

            <View className="h-[270px]">
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

          <View className="mb-3 rounded-[24px] border border-[#d6e1f3] bg-white p-4">
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by title, city, address..."
              className="rounded-xl border border-[#d9e5f7] bg-[#f8fbff] px-3 py-3 text-[15px] text-[#142748]"
              placeholderTextColor="#6a7fa2"
            />

            <View className="mt-2 flex-row gap-2">
              <TextInput
                value={cityFilter}
                onChangeText={setCityFilter}
                placeholder="City filter"
                className="flex-1 rounded-xl border border-[#d9e5f7] bg-[#f8fbff] px-3 py-3 text-sm text-[#142748]"
                placeholderTextColor="#6a7fa2"
              />
              <TextInput
                value={radiusInput}
                onChangeText={setRadiusInput}
                keyboardType="decimal-pad"
                placeholder="Radius"
                className="w-24 rounded-xl border border-[#d9e5f7] bg-[#f8fbff] px-3 py-3 text-sm text-[#142748]"
                placeholderTextColor="#6a7fa2"
              />
              <Pressable onPress={() => void handleRefresh()} className="h-[46px] w-[46px] items-center justify-center rounded-xl bg-[#e6efff]">
                <FontAwesomeIcon icon={faRotateRight as IconProp} size={14} color="#1d4ed8" />
              </Pressable>
            </View>

            <View className="mt-3 flex-row flex-wrap gap-2">
              <FilterPill label="All" active={category === 'ALL'} onPress={() => setCategory('ALL')} />
              {categoryOptions.map((option) => (
                <FilterPill
                  key={option.value}
                  label={option.label}
                  active={category === option.value}
                  onPress={() => setCategory(option.value)}
                />
              ))}
            </View>
          </View>

          {selectedSpot ? (
            <View className="mb-3 rounded-2xl border border-[#d7e1f2] bg-[#eef4ff] px-4 py-3">
              <Text className="text-xs font-bold uppercase tracking-[0.12em] text-[#4e6385]">Selected Place</Text>
              <Text className="mt-1 text-base font-bold text-[#0f2244]">{selectedSpot.title}</Text>
              <Text className="mt-1 text-xs text-[#4e6385]">{selectedSpot.address || selectedSpot.city}</Text>
            </View>
          ) : null}

          {isLoading ? (
            <View className="rounded-2xl border border-[#d7e1f2] bg-white px-4 py-8">
              <ActivityIndicator size="large" color="#1d4ed8" />
            </View>
          ) : filteredSpots.length === 0 ? (
            <View className="rounded-2xl border border-dashed border-[#c9d7ee] bg-white px-4 py-8">
              <Text className="text-center text-sm font-semibold text-[#58709a]">No spots found with current filters.</Text>
            </View>
          ) : (
            <View className="gap-3">
              {filteredSpots.map((spot) => {
                const badge = reviewBadgeStyles(spot.reviewStatus);
                const canDelete = userRole === 'ADMIN' || userId === spot.createdById;
                const isBusy = workingSpotId === spot.id;
                const isSelected = selectedSpot?.id === spot.id;

                return (
                  <Pressable
                    key={spot.id}
                    onPress={() => setSelectedSpotId(spot.id)}
                    className={`rounded-2xl border p-4 ${isSelected ? 'border-[#1d4ed8] bg-[#f2f7ff]' : 'border-[#d7e1f2] bg-white'}`}
                  >
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="text-base font-extrabold text-[#0f2244]">{spot.title}</Text>
                        <Text className="mt-1 text-xs text-[#4e6385]">{categoryLabel(spot.category)} • {spot.city}</Text>
                      </View>

                      <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: badge.backgroundColor }}>
                        <Text className="text-[10px] font-bold uppercase" style={{ color: badge.textColor }}>
                          {spot.reviewStatus}
                        </Text>
                      </View>
                    </View>

                    {spot.address ? (
                      <View className="mt-2 flex-row items-center gap-2">
                        <FontAwesomeIcon icon={faLocationDot as IconProp} size={12} color="#51678c" />
                        <Text className="flex-1 text-sm text-[#304562]">{spot.address}</Text>
                      </View>
                    ) : null}

                    {spot.description ? <Text className="mt-2 text-sm text-[#304562]">{spot.description}</Text> : null}

                    <Text className="mt-2 text-xs font-semibold text-[#637aa1]">
                      {formatDistance(spot.distanceKm)} • {spot.visitCount} visits
                    </Text>

                    <View className="mt-3 flex-row flex-wrap gap-2">
                      <Pressable onPress={() => void handleOpenSpot(spot)} className="flex-row items-center gap-2 rounded-xl bg-[#e6efff] px-3 py-2">
                        <FontAwesomeIcon icon={faCompass as IconProp} size={12} color="#1d4ed8" />
                        <Text className="text-xs font-bold text-[#1d4ed8]">Open</Text>
                      </Pressable>

                      <Pressable onPress={() => void handleOpenDirections(spot)} className="flex-row items-center gap-2 rounded-xl bg-[#ecfdf3] px-3 py-2">
                        <FontAwesomeIcon icon={faRoute as IconProp} size={12} color="#15803d" />
                        <Text className="text-xs font-bold text-[#15803d]">Directions</Text>
                      </Pressable>

                      {canDelete ? (
                        <Pressable
                          onPress={() => void handleDeactivate(spot)}
                          disabled={isBusy}
                          className={`flex-row items-center gap-2 rounded-xl px-3 py-2 ${isBusy ? 'bg-[#f5d0d5]' : 'bg-[#fee2e2]'}`}
                        >
                          <FontAwesomeIcon icon={faTrash as IconProp} size={12} color="#991b1b" />
                          <Text className="text-xs font-bold text-[#991b1b]">{isBusy ? 'Deleting...' : 'Delete'}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {isRefreshing ? (
            <View className="mt-3 items-center">
              <ActivityIndicator size="small" color="#1d4ed8" />
            </View>
          ) : null}
        </ScrollView>

        <Modal visible={showSuggestModal} transparent animationType="slide" onRequestClose={() => setShowSuggestModal(false)}>
          <Pressable className="flex-1 justify-end bg-black/35" onPress={() => setShowSuggestModal(false)}>
            <Pressable className="rounded-t-[28px] bg-white px-4 pb-6 pt-4" onPress={() => {}}>
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-lg font-extrabold text-[#0f2244]">Suggest a New Place</Text>
                <Pressable onPress={() => setShowSuggestModal(false)} className="h-8 w-8 items-center justify-center rounded-full bg-[#eef4ff]">
                  <FontAwesomeIcon icon={faX as IconProp} size={13} color="#4e6385" />
                </Pressable>
              </View>

              <TextInput
                value={suggestTitle}
                onChangeText={setSuggestTitle}
                placeholder="Title"
                className="mb-2 rounded-xl border border-[#d9e5f7] bg-[#f8fbff] px-3 py-3 text-sm text-[#142748]"
                placeholderTextColor="#6a7fa2"
              />

              <TextInput
                value={suggestDescription}
                onChangeText={setSuggestDescription}
                placeholder="Description (optional)"
                className="mb-2 rounded-xl border border-[#d9e5f7] bg-[#f8fbff] px-3 py-3 text-sm text-[#142748]"
                placeholderTextColor="#6a7fa2"
                multiline
              />

              <TextInput
                value={suggestAddress}
                onChangeText={setSuggestAddress}
                placeholder="Address (optional)"
                className="mb-2 rounded-xl border border-[#d9e5f7] bg-[#f8fbff] px-3 py-3 text-sm text-[#142748]"
                placeholderTextColor="#6a7fa2"
              />

              <TextInput
                value={suggestCity}
                onChangeText={setSuggestCity}
                placeholder="City"
                className="mb-2 rounded-xl border border-[#d9e5f7] bg-[#f8fbff] px-3 py-3 text-sm text-[#142748]"
                placeholderTextColor="#6a7fa2"
              />

              <View className="mb-2 rounded-xl border border-[#d9e5f7] bg-[#f8fbff] px-3 py-3">
                <Text className="text-xs font-bold uppercase text-[#4e6385]">Suggestion Pin</Text>
                <Text className="mt-1 text-sm text-[#1f3a63]">{suggestPlaceLabel}</Text>
              </View>

              <View className="mb-2 h-[160px] overflow-hidden rounded-xl border border-[#d9e5f7]">
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
                  <Marker coordinate={suggestPoint} title="Suggestion Pin" pinColor="#1d4ed8" />
                </MapView>
              </View>

              <Pressable onPress={() => void handleUseCurrentLocationForSuggestion()} className="mb-3 items-center rounded-xl bg-[#eef4ff] px-3 py-2">
                <Text className="text-xs font-bold text-[#1d4ed8]">Use my current location</Text>
              </Pressable>

              <Pressable
                onPress={() => void handleSubmitSuggestion()}
                disabled={isSubmittingSuggestion}
                className={`items-center rounded-xl px-3 py-3 ${isSubmittingSuggestion ? 'bg-[#93b2f2]' : 'bg-[#1d4ed8]'}`}
              >
                <Text className="text-sm font-bold text-white">{isSubmittingSuggestion ? 'Submitting...' : 'Submit for review'}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <View className="bg-white">
          <MobileBottomNav activeTab="geo-board" onNavigate={handleNavigateBottom} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`rounded-full px-3 py-1.5 ${active ? 'bg-[#1d4ed8]' : 'bg-[#ebf2ff]'}`}>
      <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-[#1d4ed8]'}`}>{label}</Text>
    </Pressable>
  );
}

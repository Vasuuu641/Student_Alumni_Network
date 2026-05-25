import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import MapView, { Marker, type Region } from 'react-native-maps';
import {
  faBookOpen,
  faComments,
  faCompass,
  faLocationDot,
  faPlus,
  faRotateRight,
  faRoute,
  faTrash,
  faUsers,
  faX,
} from '@fortawesome/free-solid-svg-icons';
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
    return { backgroundColor: '#d9f8e6', textColor: '#14653a' };
  }

  if (reviewStatus === 'REJECTED') {
    return { backgroundColor: '#fde8ec', textColor: '#9c2f3f' };
  }

  return { backgroundColor: '#fff5dc', textColor: '#8a5b00' };
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

export function GeoHelpBoardPage({ navigation }: Props) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ResourceTab>('OFFICIAL');
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [cityFilter, setCityFilter] = useState('');
  const [radiusInput, setRadiusInput] = useState('5');
  const [point, setPoint] = useState<Point>(DEFAULT_POINT);
  const [latitudeInput, setLatitudeInput] = useState(String(DEFAULT_POINT.latitude));
  const [longitudeInput, setLongitudeInput] = useState(String(DEFAULT_POINT.longitude));

  const [spots, setSpots] = useState<GeoHelpSpot[]>([]);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [workingSpotId, setWorkingSpotId] = useState<string | null>(null);

  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestDescription, setSuggestDescription] = useState('');
  const [suggestAddress, setSuggestAddress] = useState('');
  const [suggestCity, setSuggestCity] = useState('Pecs');
  const [suggestLat, setSuggestLat] = useState(String(DEFAULT_POINT.latitude));
  const [suggestLng, setSuggestLng] = useState(String(DEFAULT_POINT.longitude));
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);

  const radiusKm = sanitizeRadius(radiusInput);
  const currentSection = TAB_SECTION_MAP[activeTab];
  const categoryOptions = activeTab === 'OFFICIAL' ? OFFICIAL_CATEGORY_OPTIONS : COMMUNITY_CATEGORY_OPTIONS;
  const apiCategory = category === 'ALL' ? undefined : category;
  const canAccessGeoHelpBoard = userRole !== 'ALUMNI';

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const token = await getValidAccessToken();
      if (cancelled) {
        return;
      }

      if (!token) {
        navigation.replace('Login');
        return;
      }

      const role = getRoleFromAccessToken(token);
      const nextUserId = getUserIdFromAccessToken(token);

      setAccessToken(token);
      setUserRole(role);
      setUserId(nextUserId);
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [navigation]);

  useEffect(() => {
    if (!noticeMessage) {
      return;
    }

    const timer = setTimeout(() => setNoticeMessage(''), 2800);
    return () => clearTimeout(timer);
  }, [noticeMessage]);

  useEffect(() => {
    const defaultCategory = categoryOptions[0]?.value ?? 'OTHER';
    if (category !== 'ALL' && !categoryOptions.some((option) => option.value === category)) {
      setCategory(defaultCategory);
    }
  }, [activeTab]);

  const fetchSpotsWithFallback = useCallback(
    async (token: string): Promise<GeoHelpSpot[]> => {
      const nearby = await listNearbyGeoHelpSpots(token, {
        latitude: point.latitude,
        longitude: point.longitude,
        radiusKm,
        city: cityFilter.trim() || undefined,
        section: currentSection,
        category: apiCategory,
        limit: 30,
      });

      if (nearby.length > 0) {
        return nearby;
      }

      const popular = await listPopularGeoHelpSpots(token, {
        city: cityFilter.trim() || undefined,
        section: currentSection,
        category: apiCategory,
        limit: 30,
      });

      return popular;
    },
    [apiCategory, cityFilter, currentSection, point.latitude, point.longitude, radiusKm],
  );

  const loadSpots = useCallback(
    async (showRefreshState: boolean) => {
      if (!accessToken || !canAccessGeoHelpBoard) {
        setIsLoading(false);
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
    void loadSpots(false);
  }, [loadSpots]);

  const handleRefresh = useCallback(async () => {
    await loadSpots(true);
  }, [loadSpots]);

  const handleApplyCoordinate = useCallback(() => {
    const nextLat = Number(latitudeInput);
    const nextLng = Number(longitudeInput);

    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
      setNoticeMessage('Please enter valid latitude and longitude.');
      return;
    }

    setPoint({ latitude: nextLat, longitude: nextLng });
    setNoticeMessage('Location updated.');
  }, [latitudeInput, longitudeInput]);

  const handleOpenSpot = useCallback(
    async (spot: GeoHelpSpot) => {
      if (!accessToken) {
        return;
      }

      try {
        await recordGeoHelpSpotVisit(accessToken, spot.id);
        await Linking.openURL(toMapUrl({ latitude: spot.latitude, longitude: spot.longitude }));
        setNoticeMessage('Opened location in maps.');
      } catch (error) {
        setNoticeMessage(error instanceof Error ? error.message : 'Failed to open location.');
      }
    },
    [accessToken],
  );

  const handleOpenDirections = useCallback(
    async (spot: GeoHelpSpot) => {
      const url = toDirectionsUrl(point, { latitude: spot.latitude, longitude: spot.longitude });
      await Linking.openURL(url);
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

    const lat = Number(suggestLat);
    const lng = Number(suggestLng);

    if (!suggestTitle.trim() || !suggestCity.trim()) {
      setNoticeMessage('Title and city are required.');
      return;
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setNoticeMessage('Valid latitude and longitude are required.');
      return;
    }

    try {
      setIsSubmittingSuggestion(true);
      await createGeoHelpSpot(accessToken, {
        title: suggestTitle.trim(),
        description: suggestDescription.trim() || undefined,
        city: suggestCity.trim(),
        address: suggestAddress.trim() || undefined,
        latitude: lat,
        longitude: lng,
        section: currentSection,
        category: category === 'ALL' ? categoryOptions[0].value : category,
      });

      setSuggestTitle('');
      setSuggestDescription('');
      setSuggestAddress('');
      setSuggestCity(cityFilter.trim() || 'Pecs');
      setSuggestLat(String(point.latitude));
      setSuggestLng(String(point.longitude));
      setShowSuggestModal(false);
      setNoticeMessage('Location submitted successfully.');
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
    cityFilter,
    currentSection,
    loadSpots,
    point.latitude,
    point.longitude,
    suggestAddress,
    suggestCity,
    suggestDescription,
    suggestLat,
    suggestLng,
    suggestTitle,
  ]);

  function navigateBottom(tab: MobileNavTab) {
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

    if (tab === 'geo-board') {
      return;
    }

    if (tab === 'notes') {
      setNoticeMessage('Notes will be added in the next mobile update.');
    }
  }

  async function handleLogout() {
    await clearTokens();
    navigation.replace('Login');
  }

  const visibleSpots = useMemo(() => spots.filter((spot) => spot.isActive), [spots]);
  const selectedSpot = useMemo(
    () => visibleSpots.find((spot) => spot.id === selectedSpotId) ?? visibleSpots[0] ?? null,
    [selectedSpotId, visibleSpots],
  );

  const mapRegion: Region = useMemo(() => {
    const center = selectedSpot
      ? { latitude: selectedSpot.latitude, longitude: selectedSpot.longitude }
      : point;

    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
  }, [point, selectedSpot]);

  useEffect(() => {
    if (visibleSpots.length === 0) {
      setSelectedSpotId(null);
      return;
    }

    if (!selectedSpotId || !visibleSpots.some((spot) => spot.id === selectedSpotId)) {
      setSelectedSpotId(visibleSpots[0].id);
    }
  }, [selectedSpotId, visibleSpots]);

  if (!accessToken || userRole === null) {
    return (
      <SafeAreaView className="flex-1 bg-[#f5f8ff]">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2f64f6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!canAccessGeoHelpBoard) {
    return (
      <SafeAreaView className="flex-1 bg-[#f5f8ff]">
        <View className="flex-1 justify-between">
          <View className="px-4 pt-6">
            <Text className="text-[28px] font-extrabold tracking-[-0.04em] text-[#101d36]">Geo Help Board</Text>
            <Text className="mt-3 text-base leading-6 text-[#5f7291]">
              This page is available to students, professors, and admins.
            </Text>
            <Pressable onPress={() => navigation.navigate('Dashboard')} className="mt-6 rounded-2xl bg-[#2f64f6] px-4 py-3">
              <Text className="text-center text-sm font-bold text-white">Back to dashboard</Text>
            </Pressable>
          </View>
          <View className="bg-white">
            <MobileBottomNav activeTab="geo-board" onNavigate={navigateBottom} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f5f8ff]">
      <View className="flex-1">
        <View className="border-b border-[#e3ebf7] bg-white px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-[24px] font-extrabold tracking-[-0.03em] text-[#101d36]">Geo Help Board</Text>
            <Pressable onPress={() => void handleLogout()} className="rounded-xl bg-[#eef3ff] px-3 py-2">
              <Text className="text-xs font-semibold text-[#2f64f6]">Logout</Text>
            </Pressable>
          </View>
          <Text className="mt-2 text-sm leading-5 text-[#5f7291]">
            Find official university services and community-picked places from the same backend as web.
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {noticeMessage ? (
            <View className="mb-3 rounded-2xl border border-[#f7d89a] bg-[#fff7e6] px-4 py-3">
              <Text className="text-sm font-semibold text-[#8d5800]">{noticeMessage}</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View className="mb-3 rounded-2xl border border-[#f5c9d0] bg-[#fff1f4] px-4 py-3">
              <Text className="text-sm font-semibold text-[#9c2f3f]">{errorMessage}</Text>
            </View>
          ) : null}

          <View className="mb-3 overflow-hidden rounded-[28px] border border-[#e3ebf7] bg-white">
            <View className="border-b border-[#e8eef8] px-4 py-4">
              <Text className="text-[18px] font-extrabold tracking-[-0.03em] text-[#101d36]">Campus Map</Text>
              <Text className="mt-1 text-sm leading-5 text-[#5f7291]">
                Tap a marker or a spot card to sync the map with the list.
              </Text>
            </View>

            <View className="h-[280px] bg-[#dce8ff]">
              <MapView
                style={{ flex: 1 }}
                initialRegion={mapRegion}
                region={mapRegion}
                onRegionChangeComplete={() => undefined}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass
                loadingEnabled
              >
                <Marker
                  coordinate={{ latitude: point.latitude, longitude: point.longitude }}
                  title="Current location"
                  description="Your selected search point"
                  pinColor="#2f64f6"
                />

                {visibleSpots.map((spot) => (
                  <Marker
                    key={spot.id}
                    coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
                    title={spot.title}
                    description={spot.city}
                    pinColor={spot.id === selectedSpot?.id ? '#1f8246' : '#f97316'}
                    onPress={() => setSelectedSpotId(spot.id)}
                  />
                ))}
              </MapView>
            </View>

            {selectedSpot ? (
              <View className="border-t border-[#e8eef8] px-4 py-3">
                <Text className="text-sm font-bold text-[#12243f]">Selected: {selectedSpot.title}</Text>
                <Text className="mt-1 text-xs leading-5 text-[#5f7291]">
                  {selectedSpot.address || selectedSpot.city} • {formatDistance(selectedSpot.distanceKm)}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="mb-3 rounded-2xl border border-[#e3ebf7] bg-white p-3">
            <View className="flex-row gap-2">
              {(['OFFICIAL', 'COMMUNITY'] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <Pressable
                    key={tab}
                    onPress={() => {
                      setActiveTab(tab);
                      setCategory('ALL');
                    }}
                    className={`flex-1 rounded-xl px-3 py-2.5 ${isActive ? 'bg-[#2f64f6]' : 'bg-[#f3f6fd]'}`}
                  >
                    <Text className={`text-center text-xs font-bold ${isActive ? 'text-white' : 'text-[#2f64f6]'}`}>
                      {tab === 'OFFICIAL' ? 'Official Resources' : 'Community Picks'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="mt-3 flex-row gap-2">
              <TextInput
                value={cityFilter}
                onChangeText={setCityFilter}
                placeholder="City (optional)"
                className="flex-1 rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-2.5 text-sm text-[#12243f]"
                placeholderTextColor="#7c8ba3"
              />
              <TextInput
                value={radiusInput}
                onChangeText={setRadiusInput}
                keyboardType="decimal-pad"
                placeholder="Radius km"
                className="w-24 rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-2.5 text-sm text-[#12243f]"
                placeholderTextColor="#7c8ba3"
              />
            </View>

            <View className="mt-3 flex-row gap-2">
              <TextInput
                value={latitudeInput}
                onChangeText={setLatitudeInput}
                keyboardType="decimal-pad"
                placeholder="Latitude"
                className="flex-1 rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-2.5 text-sm text-[#12243f]"
                placeholderTextColor="#7c8ba3"
              />
              <TextInput
                value={longitudeInput}
                onChangeText={setLongitudeInput}
                keyboardType="decimal-pad"
                placeholder="Longitude"
                className="flex-1 rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-2.5 text-sm text-[#12243f]"
                placeholderTextColor="#7c8ba3"
              />
            </View>

            <View className="mt-3 flex-row gap-2">
              <Pressable onPress={handleApplyCoordinate} className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#eaf1ff] px-3 py-2.5">
                <FontAwesomeIcon icon={faLocationDot as IconProp} size={13} color="#2f64f6" />
                <Text className="text-xs font-bold text-[#2f64f6]">Use Coordinates</Text>
              </Pressable>
              <Pressable onPress={() => void handleRefresh()} className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#eff8f1] px-3 py-2.5">
                <FontAwesomeIcon icon={faRotateRight as IconProp} size={13} color="#1f8246" />
                <Text className="text-xs font-bold text-[#1f8246]">Refresh</Text>
              </Pressable>
              <Pressable onPress={() => setShowSuggestModal(true)} className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#2f64f6] px-3 py-2.5">
                <FontAwesomeIcon icon={faPlus as IconProp} size={13} color="white" />
                <Text className="text-xs font-bold text-white">Suggest</Text>
              </Pressable>
            </View>
          </View>

          <View className="mb-3 rounded-2xl border border-[#e3ebf7] bg-white p-3">
            <Text className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#6d7fa1]">Category Filter</Text>
            <View className="flex-row flex-wrap gap-2">
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

          {isLoading ? (
            <View className="rounded-2xl border border-[#e3ebf7] bg-white p-8">
              <ActivityIndicator size="large" color="#2f64f6" />
            </View>
          ) : visibleSpots.length === 0 ? (
            <View className="rounded-2xl border border-dashed border-[#d8e2f4] bg-[#fafcff] px-4 py-8">
              <Text className="text-center text-sm font-semibold text-[#7182a0]">No spots found with the current filters.</Text>
            </View>
          ) : (
            <View className="gap-3">
              {visibleSpots.map((spot) => {
                const badge = reviewBadgeStyles(spot.reviewStatus);
                const canDelete = userRole === 'ADMIN' || userId === spot.createdById;
                const isBusy = workingSpotId === spot.id;
                const isSelected = spot.id === selectedSpot?.id;

                return (
                  <Pressable
                    key={spot.id}
                    onPress={() => setSelectedSpotId(spot.id)}
                    className={`rounded-2xl border p-4 ${isSelected ? 'border-[#2f64f6] bg-[#f7faff]' : 'border-[#e3ebf7] bg-white'}`}
                  >
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="text-base font-extrabold text-[#12243f]">{spot.title}</Text>
                        <Text className="mt-1 text-sm text-[#5f7291]">{categoryLabel(spot.category)} • {spot.city}</Text>
                      </View>
                      <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: badge.backgroundColor }}>
                        <Text className="text-[10px] font-bold uppercase" style={{ color: badge.textColor }}>{spot.reviewStatus}</Text>
                      </View>
                    </View>

                    {spot.address ? (
                      <Text className="mt-2 text-sm leading-5 text-[#3a4d6a]">{spot.address}</Text>
                    ) : null}

                    {spot.description ? (
                      <Text className="mt-2 text-sm leading-5 text-[#3a4d6a]">{spot.description}</Text>
                    ) : null}

                    <Text className="mt-2 text-xs font-semibold text-[#7b8ca7]">{formatDistance(spot.distanceKm)} • {spot.visitCount} visits</Text>

                    <View className="mt-3 flex-row flex-wrap gap-2">
                      <Pressable onPress={() => void handleOpenSpot(spot)} className="flex-row items-center gap-2 rounded-xl bg-[#eaf1ff] px-3 py-2">
                        <FontAwesomeIcon icon={faCompass as IconProp} size={12} color="#2f64f6" />
                        <Text className="text-xs font-bold text-[#2f64f6]">Open</Text>
                      </Pressable>

                      <Pressable onPress={() => void handleOpenDirections(spot)} className="flex-row items-center gap-2 rounded-xl bg-[#eff8f1] px-3 py-2">
                        <FontAwesomeIcon icon={faRoute as IconProp} size={12} color="#1f8246" />
                        <Text className="text-xs font-bold text-[#1f8246]">Directions</Text>
                      </Pressable>

                      {canDelete ? (
                        <Pressable
                          onPress={() => void handleDeactivate(spot)}
                          disabled={isBusy}
                          className={`flex-row items-center gap-2 rounded-xl px-3 py-2 ${isBusy ? 'bg-[#f3d9de]' : 'bg-[#fde8ec]'}`}
                        >
                          <FontAwesomeIcon icon={faTrash as IconProp} size={12} color="#9c2f3f" />
                          <Text className="text-xs font-bold text-[#9c2f3f]">{isBusy ? 'Deleting...' : 'Delete'}</Text>
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
              <ActivityIndicator size="small" color="#2f64f6" />
            </View>
          ) : null}
        </ScrollView>

        <Modal visible={showSuggestModal} transparent animationType="fade" onRequestClose={() => setShowSuggestModal(false)}>
          <Pressable className="flex-1 justify-end bg-black/30" onPress={() => setShowSuggestModal(false)}>
            <Pressable className="rounded-t-[28px] bg-white px-4 pb-6 pt-4" onPress={() => {}}>
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-lg font-extrabold text-[#12243f]">Suggest Location</Text>
                <Pressable onPress={() => setShowSuggestModal(false)} className="h-8 w-8 items-center justify-center rounded-full bg-[#eff3fb]">
                  <FontAwesomeIcon icon={faX as IconProp} size={13} color="#5f7291" />
                </Pressable>
              </View>

              <TextInput
                value={suggestTitle}
                onChangeText={setSuggestTitle}
                placeholder="Title"
                className="mb-2 rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-3 text-sm text-[#12243f]"
                placeholderTextColor="#7c8ba3"
              />

              <TextInput
                value={suggestDescription}
                onChangeText={setSuggestDescription}
                placeholder="Description (optional)"
                className="mb-2 rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-3 text-sm text-[#12243f]"
                placeholderTextColor="#7c8ba3"
                multiline
              />

              <TextInput
                value={suggestAddress}
                onChangeText={setSuggestAddress}
                placeholder="Address (optional)"
                className="mb-2 rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-3 text-sm text-[#12243f]"
                placeholderTextColor="#7c8ba3"
              />

              <TextInput
                value={suggestCity}
                onChangeText={setSuggestCity}
                placeholder="City"
                className="mb-2 rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-3 text-sm text-[#12243f]"
                placeholderTextColor="#7c8ba3"
              />

              <View className="mb-2 flex-row gap-2">
                <TextInput
                  value={suggestLat}
                  onChangeText={setSuggestLat}
                  keyboardType="decimal-pad"
                  placeholder="Latitude"
                  className="flex-1 rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-3 text-sm text-[#12243f]"
                  placeholderTextColor="#7c8ba3"
                />
                <TextInput
                  value={suggestLng}
                  onChangeText={setSuggestLng}
                  keyboardType="decimal-pad"
                  placeholder="Longitude"
                  className="flex-1 rounded-xl border border-[#d8e1f3] bg-[#f9fbff] px-3 py-3 text-sm text-[#12243f]"
                  placeholderTextColor="#7c8ba3"
                />
              </View>

              <Pressable
                onPress={() => {
                  setSuggestLat(String(point.latitude));
                  setSuggestLng(String(point.longitude));
                }}
                className="mb-3 items-center rounded-xl bg-[#eef3ff] px-3 py-2"
              >
                <Text className="text-xs font-bold text-[#2f64f6]">Use current coordinates</Text>
              </Pressable>

              <Pressable
                onPress={() => void handleSubmitSuggestion()}
                disabled={isSubmittingSuggestion}
                className={`items-center rounded-xl px-3 py-3 ${isSubmittingSuggestion ? 'bg-[#97b5ff]' : 'bg-[#2f64f6]'}`}
              >
                <Text className="text-sm font-bold text-white">{isSubmittingSuggestion ? 'Submitting...' : 'Submit location'}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <View className="bg-white">
          <MobileBottomNav activeTab="geo-board" onNavigate={navigateBottom} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`rounded-full px-3 py-1.5 ${active ? 'bg-[#2f64f6]' : 'bg-[#eef3ff]'}`}>
      <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-[#2f64f6]'}`}>{label}</Text>
    </Pressable>
  );
}

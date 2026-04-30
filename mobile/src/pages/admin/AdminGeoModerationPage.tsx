import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCheckCircle, faTimesCircle, faTrash, faSearch } from '@fortawesome/free-solid-svg-icons';
import {
  listGeoReviewQueue,
  reviewGeoSpot,
  deactivateGeoSpot,
  type GeoSpotForReview,
  type GeoReviewStatus,
  type GeoSection,
  type GeoCategory,
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

const GEO_STATUSES: Array<'ALL' | GeoReviewStatus> = ['ALL', 'PENDING', 'VERIFIED', 'REJECTED'];

interface AdminGeoModerationPageProps {
  token: string;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

export function AdminGeoModerationPage({ token }: AdminGeoModerationPageProps) {
  const [spots, setSpots] = useState<GeoSpotForReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'ALL' | GeoReviewStatus>('PENDING');
  const [sectionFilter, setSectionFilter] = useState<'ALL' | GeoSection>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | GeoCategory>('ALL');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    void loadQueue();
  }, [statusFilter, sectionFilter, categoryFilter]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timeout);
  }, [notice]);

  async function loadQueue() {
    try {
      setLoading(true);
      setError(null);
      const data = await listGeoReviewQueue(token, {
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
      return titleMatch || cityMatch;
    });
  }, [spots, searchText]);

  async function handleReviewSpot(spotId: string, isVerified: boolean) {
    try {
      setActingId(spotId);
      setError(null);
      await reviewGeoSpot(token, spotId, isVerified);
      setSpots((prev) =>
        prev.map((spot) =>
          spot.id === spotId
            ? {
                ...spot,
                reviewStatus: isVerified ? 'VERIFIED' : 'REJECTED',
              }
            : spot,
        ),
      );
      setNotice(`Spot marked as ${isVerified ? 'verified' : 'rejected'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review spot.');
    } finally {
      setActingId(null);
    }
  }

  async function handleDeactivateSpot(spotId: string) {
    try {
      setActingId(spotId);
      setError(null);
      await deactivateGeoSpot(token, spotId);
      setSpots((prev) =>
        prev.map((spot) =>
          spot.id === spotId
            ? {
                ...spot,
                isActive: false,
              }
            : spot,
        ),
      );
      setNotice('Spot deactivated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate spot.');
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Error Message */}
      {error && (
        <View style={{ backgroundColor: '#fee', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 8 }}>
          <Text style={{ color: '#c00', fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {/* Notice Message */}
      {notice && (
        <View style={{ backgroundColor: '#efe', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 8 }}>
          <Text style={{ color: '#060', fontSize: 13 }}>{notice}</Text>
        </View>
      )}

      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 4 }}>Geo Moderation</Text>
        <Text style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Review and approve geo spots</Text>

        {/* Search */}
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', paddingHorizontal: 12, borderRadius: 8 }}>
            <FontAwesomeIcon icon={faSearch} size={14} color="#999" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search by title or city..."
              value={searchText}
              onChangeText={setSearchText}
              style={{ flex: 1, paddingVertical: 10, fontSize: 14 }}
            />
          </View>
        </View>

        {/* Status Filter */}
        <Text style={{ fontSize: 11, fontWeight: '500', marginBottom: 8, color: '#666', textTransform: 'uppercase' }}>
          Status
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {GEO_STATUSES.map((status) => (
            <Pressable
              key={status}
              onPress={() => setStatusFilter(status)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                marginRight: 8,
                borderRadius: 16,
                 backgroundColor: statusFilter === status ? '#1e40af' : '#e8e8e8',
              }}
            >
              <Text style={{ fontSize: 12, color: statusFilter === status ? '#fff' : '#333', fontWeight: '500' }}>
                {status}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Section Filter */}
        <Text style={{ fontSize: 11, fontWeight: '500', marginBottom: 8, color: '#666', textTransform: 'uppercase' }}>
          Section
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {GEO_SECTIONS.map((section) => (
            <Pressable
              key={section}
              onPress={() => setSectionFilter(section)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                marginRight: 8,
                borderRadius: 16,
                 backgroundColor: sectionFilter === section ? '#1e40af' : '#e8e8e8',
              }}
            >
              <Text style={{ fontSize: 12, color: sectionFilter === section ? '#fff' : '#333', fontWeight: '500' }}>
                {section === 'ALL' ? 'All' : section.replace(/_/g, ' ')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Category Filter */}
        <Text style={{ fontSize: 11, fontWeight: '500', marginBottom: 8, color: '#666', textTransform: 'uppercase' }}>
          Category
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {GEO_CATEGORIES.map((category) => (
            <Pressable
              key={category}
              onPress={() => setCategoryFilter(category)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                marginRight: 8,
                borderRadius: 16,
                 backgroundColor: categoryFilter === category ? '#1e40af' : '#e8e8e8',
              }}
            >
              <Text style={{ fontSize: 12, color: categoryFilter === category ? '#fff' : '#333', fontWeight: '500' }}>
                {category === 'ALL' ? 'All' : category.replace(/_/g, ' ')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Spots List */}
      <FlatList
        data={filteredSpots}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#e0e0e0' }}>
              <View style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 }}>{item.title}</Text>
                  <View style={{ backgroundColor: item.reviewStatus === 'VERIFIED' ? '#e8f5e9' : item.reviewStatus === 'REJECTED' ? '#ffe0e0' : '#fff3e0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                    <Text style={{ fontSize: 10, color: item.reviewStatus === 'VERIFIED' ? '#1b5e20' : item.reviewStatus === 'REJECTED' ? '#c62828' : '#e65100', fontWeight: '500' }}>
                      {item.reviewStatus}
                    </Text>
                  </View>
                </View>

                {item.description && (
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}

                <View style={{ backgroundColor: '#f5f5f5', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 4, marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>📍 {item.city}</Text>
                  {item.address && (
                    <Text style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{item.address}</Text>
                  )}
                  <Text style={{ fontSize: 10, color: '#999' }}>
                    {formatCoordinates(item.latitude, item.longitude)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <View style={{ flex: 1, backgroundColor: '#e3f2fd', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4 }}>
                    <Text style={{ fontSize: 11, color: '#1976d2', fontWeight: '500' }}>{item.category}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#f3e5f5', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4 }}>
                    <Text style={{ fontSize: 11, color: '#6a1b9a', fontWeight: '500' }}>{item.section}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#fce4ec', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4 }}>
                    <Text style={{ fontSize: 11, color: '#ad1457', fontWeight: '500' }}>👁️ {item.visitCount}</Text>
                  </View>
                </View>

                <Text style={{ fontSize: 10, color: '#999' }}>
                  Created: {formatDateTime(item.createdAt)}
                </Text>
              </View>

              {/* Action Buttons */}
              {item.reviewStatus === 'PENDING' && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => handleReviewSpot(item.id, true)}
                    disabled={actingId !== null}
                    style={{ flex: 1, paddingVertical: 8, backgroundColor: '#e8f5e9', borderRadius: 4, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}
                  >
                    {actingId === item.id ? (
                      <ActivityIndicator size="small" color="#1b5e20" />
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faCheckCircle} size={12} color="#1b5e20" />
                        <Text style={{ fontSize: 12, color: '#1b5e20', fontWeight: '600' }}>Approve</Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => handleReviewSpot(item.id, false)}
                    disabled={actingId !== null}
                    style={{ flex: 1, paddingVertical: 8, backgroundColor: '#ffe0e0', borderRadius: 4, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}
                  >
                    {actingId === item.id ? (
                      <ActivityIndicator size="small" color="#c62828" />
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faTimesCircle} size={12} color="#c62828" />
                        <Text style={{ fontSize: 12, color: '#c62828', fontWeight: '600' }}>Reject</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}

              {item.isActive && (
                <Pressable
                  onPress={() => handleDeactivateSpot(item.id)}
                  disabled={actingId !== null}
                  style={{ paddingVertical: 8, backgroundColor: '#fce4ec', borderRadius: 4, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: item.reviewStatus === 'PENDING' ? 8 : 0 }}
                >
                  {actingId === item.id ? (
                    <ActivityIndicator size="small" color="#ad1457" />
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faTrash} size={12} color="#ad1457" />
                      <Text style={{ fontSize: 12, color: '#ad1457', fontWeight: '600' }}>Deactivate</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 16, paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#999' }}>No spots found</Text>
          </View>
        }
        scrollEnabled={false}
      />
    </View>
  );
}

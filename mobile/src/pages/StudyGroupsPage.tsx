import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faArchive,
  faArrowLeft,
  faChevronRight,
  faGlobe,
  faLock,
  faPlus,
  faRightFromBracket,
  faTrash,
  faWandSparkles,
  faX,
} from '@fortawesome/free-solid-svg-icons';
import { MobileBottomNav, type MobileNavTab } from '../components/MobileBottomNav';
import {
  archiveStudyGroup,
  createStudyGroup,
  deleteStudyGroup,
  joinStudyGroup,
  leaveStudyGroup,
  listArchivedStudyGroups,
  listRecommendedStudyGroups,
  listStudyGroups,
  listStudyGroupMembers,
  unarchiveStudyGroup,
  type RecommendedStudyGroup,
  type StudyGroup,
  type StudyGroupVisibility,
} from '../api/study-groups.api';
import { getValidAccessToken } from '../lib/auth-session';
import { clearTokens } from '../lib/auth-storage';
import type { RootStackParamList } from '../navigation/root-stack';
import { useTheme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'StudyGroups'>;
type GroupTab = 'MY' | 'DISCOVER' | 'ARCHIVED';

const VISIBILITY_COLORS: Record<StudyGroupVisibility, string> = {
  PUBLIC: '#10b981',
  PRIVATE: '#f59e0b',
};

interface GroupWithMemberCount extends StudyGroup {
  memberCount?: number;
}

export function StudyGroupsPage({ navigation }: Props) {
  const { tokens } = useTheme();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tab, setTab] = useState<GroupTab>('MY');
  const [groups, setGroups] = useState<GroupWithMemberCount[]>([]);
  const [recommendedGroups, setRecommendedGroups] = useState<RecommendedStudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<StudyGroupVisibility>('PUBLIC');

  const [workingGroupId, setWorkingGroupId] = useState<string | null>(null);

  // Initialize and load access token
  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const token = await getValidAccessToken();
        if (!cancelled) {
          setAccessToken(token);
        }
      } catch {
        if (!cancelled) {
          await clearTokens();
          navigation.replace('Home');
        }
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  // Load groups when tab changes
  useFocusEffect(
    useCallback(() => {
      const token = accessToken;
      if (!token) return;
      const activeToken = token as string;

      let cancelled = false;

      async function fetchData() {
        try {
          setLoading(true);
          setErrorMessage('');

          let data: StudyGroup[] = [];
          if (tab === 'MY') {
            // No filter — API returns groups the authenticated user belongs to
            data = await listStudyGroups(activeToken);
          } else if (tab === 'DISCOVER') {
            // Show all public groups for discovery
            data = await listStudyGroups(activeToken, { visibility: 'PUBLIC' });
          } else if (tab === 'ARCHIVED') {
            data = await listArchivedStudyGroups(activeToken);
          }

          if (cancelled) return;

          // Fetch member counts for each group
          const groupsWithCounts = await Promise.all(
            data.map(async (group) => {
              try {
                const members = await listStudyGroupMembers(activeToken, group.id);
                const activeCount = members.filter((m) => m.joinStatus === 'ACTIVE').length;
                return { ...group, memberCount: activeCount };
              } catch {
                return { ...group, memberCount: 0 };
              }
            }),
          );

          if (cancelled) return;
          setGroups(groupsWithCounts);
        } catch (error) {
          if (!cancelled) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch groups.');
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      }

      void fetchData();

      return () => {
        cancelled = true;
      };
    }, [accessToken, tab]),
  );

  const handleGetRecommendations = async () => {
    if (!accessToken) return;
    try {
      setIsLoadingRecommendations(true);
      setErrorMessage('');
      const recs = await listRecommendedStudyGroups(accessToken);
      setRecommendedGroups(recs);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load recommendations.');
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!accessToken || !name.trim()) return;

    try {
      setIsCreating(true);
      setCreateError('');
      const newGroup = await createStudyGroup(accessToken, {
        name: name.trim(),
        description: description.trim(),
        visibility,
        initialMemberIds: [],
      });

      setName('');
      setDescription('');
      setVisibility('PUBLIC');
      setShowCreateModal(false);
      setTab('MY');
      setGroups((prev) => [...prev, { ...newGroup, memberCount: 1 }]);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create group.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (groupId: string) => {
    if (!accessToken) return;
    try {
      setWorkingGroupId(groupId);
      await joinStudyGroup(accessToken, groupId);
      // Move group to MY tab view by refreshing
      setTab('MY');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to join group.');
    } finally {
      setWorkingGroupId(null);
    }
  };

  const handleLeave = (group: GroupWithMemberCount) => {
    Alert.alert('Leave Group', `Are you sure you want to leave "${group.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          if (!accessToken) return;
          try {
            setWorkingGroupId(group.id);
            await leaveStudyGroup(accessToken, group.id);
            setGroups((prev) => prev.filter((g) => g.id !== group.id));
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to leave group.');
          } finally {
            setWorkingGroupId(null);
          }
        },
      },
    ]);
  };

  const handleArchive = async (group: GroupWithMemberCount) => {
    if (!accessToken) return;
    try {
      setWorkingGroupId(group.id);
      await archiveStudyGroup(accessToken, group.id);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to archive group.');
    } finally {
      setWorkingGroupId(null);
    }
  };

  const handleUnarchive = async (group: GroupWithMemberCount) => {
    if (!accessToken) return;
    try {
      setWorkingGroupId(group.id);
      await unarchiveStudyGroup(accessToken, group.id);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to unarchive group.');
    } finally {
      setWorkingGroupId(null);
    }
  };

  const handleDelete = (group: GroupWithMemberCount) => {
    Alert.alert('Delete Group', `Are you sure you want to permanently delete "${group.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!accessToken) return;
          try {
            setWorkingGroupId(group.id);
            await deleteStudyGroup(accessToken, group.id);
            setGroups((prev) => prev.filter((g) => g.id !== group.id));
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to delete group.');
          } finally {
            setWorkingGroupId(null);
          }
        },
      },
    ]);
  };

  const filteredGroups = useMemo(() => {
    if (!searchText.trim()) return groups;
    const query = searchText.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(query) ||
        (g.description?.toLowerCase().includes(query) ?? false),
    );
  }, [groups, searchText]);

  const handleNavigate = (navTab: MobileNavTab) => {
    if (navTab === 'study-groups') return;
    if (navTab === 'home') { navigation.navigate('Dashboard'); return; }
    if (navTab === 'discussions') { navigation.navigate('Discussions'); return; }
    if (navTab === 'geo-board') { navigation.navigate('GeoHelpBoard'); return; }
    if (navTab === 'notes') { navigation.navigate('Notes'); return; }
  };

  if (!accessToken) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
        <StatusBar style={tokens.name === 'midnight' ? 'light' : 'dark'} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={tokens.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <StatusBar style={tokens.name === 'midnight' ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>

        {/* Header */}
        <View style={{ borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.surface, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => navigation.navigate('Dashboard')} style={{ padding: 4 }}>
              <FontAwesomeIcon icon={faArrowLeft as IconProp} size={18} color={tokens.muted} />
            </Pressable>
            <Text style={{ fontSize: 24, fontWeight: '800', color: tokens.text }}>Study Groups</Text>
          </View>
          <Pressable
            onPress={() => setShowCreateModal(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, backgroundColor: tokens.primary, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <FontAwesomeIcon icon={faPlus as IconProp} size={14} color="white" />
            <Text style={{ fontWeight: '700', color: 'white', fontSize: 14 }}>Create</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={{ borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            {(['MY', 'DISCOVER', 'ARCHIVED'] as const).map((t) => {
              const isActive = tab === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={{ borderBottomWidth: 2, borderBottomColor: isActive ? tokens.primary : 'transparent', paddingVertical: 14 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: isActive ? '700' : '500', color: isActive ? tokens.primary : tokens.muted }}>
                    {t === 'MY' ? 'My Groups' : t === 'DISCOVER' ? 'Discover' : 'Archived'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* AI Recommendations (only on DISCOVER tab) */}
        {tab === 'DISCOVER' && !loading && (
          <View style={{ borderBottomWidth: 1, borderBottomColor: tokens.border, paddingHorizontal: 16, paddingVertical: 16 }}>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FontAwesomeIcon icon={faWandSparkles as IconProp} size={18} color={tokens.primary} />
                <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.text }}>AI-Suggested For You</Text>
              </View>
              {recommendedGroups.length === 0 && !isLoadingRecommendations ? (
                <Pressable
                  onPress={handleGetRecommendations}
                  style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 12, backgroundColor: tokens.primarySoft, paddingHorizontal: 12, paddingVertical: 8 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.primary }}>Get recommendations</Text>
                </Pressable>
              ) : isLoadingRecommendations ? (
                <ActivityIndicator size="small" color={tokens.primary} style={{ marginTop: 8 }} />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 12 }}>
                  {recommendedGroups.map((group) => (
                    <Pressable
                      key={group.id}
                      onPress={() => navigation.navigate('StudyGroupDetail', { groupId: group.id })}
                      style={{ width: 280, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 14 }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.text }}>{group.name}</Text>
                          <Text style={{ marginTop: 4, fontSize: 13, color: tokens.muted }}>{group.description}</Text>
                        </View>
                        <View style={{ alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: tokens.primarySoft, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: tokens.primary }}>
                            {Math.round(group.score * 100)}%
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => void handleJoin(group.id)}
                        style={{ marginTop: 10, borderRadius: 8, backgroundColor: tokens.primary, paddingVertical: 7, alignItems: 'center' }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: 'white' }}>Join</Text>
                      </Pressable>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        )}

        {/* Search */}
        <View style={{ borderBottomWidth: 1, borderBottomColor: tokens.border, paddingHorizontal: 16, paddingVertical: 12 }}>
          <TextInput
            placeholder="Search groups..."
            value={searchText}
            onChangeText={setSearchText}
            style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tokens.text }}
            placeholderTextColor={tokens.muted}
          />
        </View>

        {/* Error banner */}
        {errorMessage ? (
          <View style={{ marginHorizontal: 16, marginTop: 8, borderRadius: 12, backgroundColor: tokens.name === 'midnight' ? '#3a1a1e' : '#ffe8e8', paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, color: tokens.danger }}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Content */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={tokens.primary} />
          </View>
        ) : filteredGroups.length === 0 ? (
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}
            style={{ flex: 1 }}
          >
            <Text style={{ textAlign: 'center', fontSize: 14, color: tokens.muted }}>
              {searchText ? 'No groups match your search.' : `No ${tab === 'ARCHIVED' ? 'archived ' : ''}groups yet.`}
            </Text>
          </ScrollView>
        ) : (
          <FlatList
            data={filteredGroups}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item: group }) => {
              const isBusy = workingGroupId === group.id;
              const isOwner = group.status !== 'DELETED'; // refine with userId if available
              return (
                <Pressable
                  onPress={() => navigation.navigate('StudyGroupDetail', { groupId: group.id })}
                  style={{ borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 14 }}
                >
                  {/* Group title row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.text }} numberOfLines={1}>{group.name}</Text>
                        <View style={{ backgroundColor: VISIBILITY_COLORS[group.visibility] + '20', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <FontAwesomeIcon
                              icon={(group.visibility === 'PUBLIC' ? faGlobe : faLock) as IconProp}
                              size={10}
                              color={VISIBILITY_COLORS[group.visibility]}
                            />
                            <Text style={{ color: VISIBILITY_COLORS[group.visibility], fontSize: 10, fontWeight: '600' }}>
                              {group.visibility}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {group.description ? (
                        <Text style={{ marginTop: 6, fontSize: 13, color: tokens.muted }} numberOfLines={2}>{group.description}</Text>
                      ) : null}
                      <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: tokens.muted }}>{group.memberCount ?? 0} members</Text>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: tokens.muted }}>
                          Created {new Date(group.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <FontAwesomeIcon icon={faChevronRight as IconProp} size={16} color={tokens.muted} />
                  </View>

                  {/* Action buttons row */}
                  <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {tab === 'DISCOVER' && (
                      <Pressable
                        onPress={() => void handleJoin(group.id)}
                        disabled={isBusy}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, backgroundColor: tokens.primarySoft, paddingHorizontal: 12, paddingVertical: 6 }}
                      >
                        <FontAwesomeIcon icon={faPlus as IconProp} size={11} color={tokens.primary} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.primary }}>{isBusy ? 'Joining...' : 'Join'}</Text>
                      </Pressable>
                    )}

                    {tab === 'MY' && (
                      <>
                        <Pressable
                          onPress={() => handleLeave(group)}
                          disabled={isBusy}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, backgroundColor: tokens.name === 'midnight' ? '#1a2a3a' : '#eff6ff', paddingHorizontal: 12, paddingVertical: 6 }}
                        >
                          <FontAwesomeIcon icon={faRightFromBracket as IconProp} size={11} color={tokens.primary} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.primary }}>{isBusy ? 'Leaving...' : 'Leave'}</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => void handleArchive(group)}
                          disabled={isBusy}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, backgroundColor: tokens.name === 'midnight' ? '#2a2010' : '#fef9c3', paddingHorizontal: 12, paddingVertical: 6 }}
                        >
                          <FontAwesomeIcon icon={faArchive as IconProp} size={11} color="#a16207" />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#a16207' }}>{isBusy ? 'Archiving...' : 'Archive'}</Text>
                        </Pressable>
                      </>
                    )}

                    {tab === 'ARCHIVED' && (
                      <>
                        <Pressable
                          onPress={() => void handleUnarchive(group)}
                          disabled={isBusy}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, backgroundColor: tokens.name === 'midnight' ? '#0d2d1a' : '#ecfdf5', paddingHorizontal: 12, paddingVertical: 6 }}
                        >
                          <FontAwesomeIcon icon={faArchive as IconProp} size={11} color="#15803d" />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#15803d' }}>{isBusy ? 'Restoring...' : 'Restore'}</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => handleDelete(group)}
                          disabled={isBusy}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, backgroundColor: tokens.name === 'midnight' ? '#3a1a1e' : '#fee2e2', paddingHorizontal: 12, paddingVertical: 6 }}
                        >
                          <FontAwesomeIcon icon={faTrash as IconProp} size={11} color={tokens.danger} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.danger }}>{isBusy ? 'Deleting...' : 'Delete'}</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      {/* Create Group Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreateModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: tokens.surface }}>
          <View style={{ flex: 1 }}>
            <View style={{ borderBottomWidth: 1, borderBottomColor: tokens.border, paddingHorizontal: 16, paddingVertical: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.text }}>Create Group</Text>
                <Pressable onPress={() => setShowCreateModal(false)} style={{ padding: 4 }}>
                  <FontAwesomeIcon icon={faX as IconProp} size={20} color={tokens.muted} />
                </Pressable>
              </View>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }} contentContainerStyle={{ gap: 16 }}>
              {createError ? (
                <View style={{ borderRadius: 12, backgroundColor: tokens.name === 'midnight' ? '#3a1a1e' : '#ffe8e8', paddingHorizontal: 16, paddingVertical: 12 }}>
                  <Text style={{ fontSize: 14, color: tokens.danger }}>{createError}</Text>
                </View>
              ) : null}

              <View>
                <Text style={{ marginBottom: 6, fontWeight: '600', fontSize: 14, color: tokens.muted }}>Group Name</Text>
                <TextInput
                  placeholder="Enter group name"
                  value={name}
                  onChangeText={setName}
                  editable={!isCreating}
                  style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tokens.text }}
                  placeholderTextColor={tokens.muted}
                />
              </View>

              <View>
                <Text style={{ marginBottom: 6, fontWeight: '600', fontSize: 14, color: tokens.muted }}>Description</Text>
                <TextInput
                  placeholder="Enter group description"
                  value={description}
                  onChangeText={setDescription}
                  editable={!isCreating}
                  multiline
                  numberOfLines={4}
                  style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tokens.text, minHeight: 100, textAlignVertical: 'top' }}
                  placeholderTextColor={tokens.muted}
                />
              </View>

              <View>
                <Text style={{ marginBottom: 6, fontWeight: '600', fontSize: 14, color: tokens.muted }}>Visibility</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {(['PUBLIC', 'PRIVATE'] as const).map((v) => {
                    const isSelected = visibility === v;
                    return (
                      <Pressable
                        key={v}
                        onPress={() => setVisibility(v)}
                        style={{
                          flex: 1, borderRadius: 12, borderWidth: 1,
                          borderColor: isSelected ? tokens.primary : tokens.border,
                          backgroundColor: isSelected ? tokens.primarySoft : tokens.surfaceElevated,
                          paddingVertical: 12,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <FontAwesomeIcon
                            icon={(v === 'PUBLIC' ? faGlobe : faLock) as IconProp}
                            size={13}
                            color={isSelected ? tokens.primary : tokens.muted}
                          />
                          <Text style={{ textAlign: 'center', fontWeight: '700', fontSize: 14, color: isSelected ? tokens.primary : tokens.muted }}>
                            {v}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable
                onPress={() => void handleCreateGroup()}
                disabled={!name.trim() || isCreating}
                style={{
                  alignItems: 'center', justifyContent: 'center', borderRadius: 12, minHeight: 48,
                  backgroundColor: name.trim() && !isCreating ? tokens.primary : tokens.primarySoft,
                  marginTop: 16,
                }}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{ fontWeight: '700', color: name.trim() && !isCreating ? 'white' : tokens.primary, fontSize: 14 }}>
                    Create Group
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Bottom Navigation */}
      <MobileBottomNav activeTab="study-groups" onNavigate={handleNavigate} />
    </SafeAreaView>
  );
}
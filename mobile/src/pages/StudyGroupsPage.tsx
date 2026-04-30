import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowLeft,
  faChevronRight,
  faGlobe,
  faLock,
  faPlus,
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

      async function fetchGroups() {
        try {
          setLoading(true);
          setErrorMessage('');

          let data: StudyGroup[] = [];
          if (tab === 'DISCOVER') {
            data = await listStudyGroups(activeToken, { visibility: 'PUBLIC' });
          } else if (tab === 'ARCHIVED') {
            data = await listArchivedStudyGroups(activeToken);
          } else {
            data = await listStudyGroups(activeToken);
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

          if (!cancelled) {
            setGroups(groupsWithCounts);
          }
        } catch (error) {
          if (!cancelled) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to load study groups.');
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      }

      void fetchGroups();

      return () => {
        cancelled = true;
      };
    }, [tab, accessToken]),
  );

  // Fetch recommendations
  const handleGetRecommendations = useCallback(async () => {
    if (!accessToken) return;

    try {
      setIsLoadingRecommendations(true);
      const recommended = await listRecommendedStudyGroups(accessToken, 5);
      setRecommendedGroups(recommended);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load recommendations.');
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [accessToken]);

  // Filter groups based on search
  const filteredGroups = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return groups;

    return groups.filter(
      (group) =>
        group.name.toLowerCase().includes(query) ||
        group.description.toLowerCase().includes(query),
    );
  }, [groups, searchText]);

  // Handle create group
  const handleCreateGroup = useCallback(async () => {
    if (!accessToken || !name.trim()) return;

    try {
      setIsCreating(true);
      setCreateError('');

      await createStudyGroup(accessToken, {
        name: name.trim(),
        description: description.trim(),
        visibility,
        initialMemberIds: [],
      });

      setName('');
      setDescription('');
      setVisibility('PUBLIC');
      setShowCreateModal(false);

      // Reload groups
      const data = await listStudyGroups(accessToken);
      const groupsWithCounts = await Promise.all(
        data.map(async (group) => {
          try {
            const members = await listStudyGroupMembers(accessToken, group.id);
            const activeCount = members.filter((m) => m.joinStatus === 'ACTIVE').length;
            return { ...group, memberCount: activeCount };
          } catch {
            return { ...group, memberCount: 0 };
          }
        }),
      );
      setGroups(groupsWithCounts);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create group.');
    } finally {
      setIsCreating(false);
    }
  }, [accessToken, name, description, visibility]);

  // Handle join/leave group
  const handleGroupAction = useCallback(
    async (groupId: string, action: 'join' | 'leave' | 'archive' | 'unarchive' | 'delete') => {
      if (!accessToken) return;

      try {
        setWorkingGroupId(groupId);

        if (action === 'join') {
          await joinStudyGroup(accessToken, groupId);
        } else if (action === 'leave') {
          await leaveStudyGroup(accessToken, groupId);
        } else if (action === 'archive') {
          await archiveStudyGroup(accessToken, groupId);
        } else if (action === 'unarchive') {
          await unarchiveStudyGroup(accessToken, groupId);
        } else if (action === 'delete') {
          await deleteStudyGroup(accessToken, groupId);
        }

        // Reload groups
        const data =
          tab === 'DISCOVER'
            ? await listStudyGroups(accessToken, { visibility: 'PUBLIC' })
            : tab === 'ARCHIVED'
              ? await listArchivedStudyGroups(accessToken)
              : await listStudyGroups(accessToken);

        const groupsWithCounts = await Promise.all(
          data.map(async (group) => {
            try {
              const members = await listStudyGroupMembers(accessToken, group.id);
              const activeCount = members.filter((m) => m.joinStatus === 'ACTIVE').length;
              return { ...group, memberCount: activeCount };
            } catch {
              return { ...group, memberCount: 0 };
            }
          }),
        );

        setGroups(groupsWithCounts);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : `Failed to ${action} group.`);
      } finally {
        setWorkingGroupId(null);
      }
    },
    [accessToken, tab],
  );

  const handleNavigate = (navTab: MobileNavTab) => {
    if (navTab === 'study-groups') {
      // Already on this page
      return;
    }

    if (navTab === 'home') {
      navigation.navigate('Dashboard');
      return;
    }

    if (navTab === 'discussions') {
      navigation.navigate('Discussions');
      return;
    }

    if (navTab === 'geo-board') {
      // TODO: Navigate to Geo Board
      return;
    }

    if (navTab === 'notes') {
      // TODO: Navigate to Notes
      return;
    }
  };

  if (!accessToken) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2f64f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="border-b border-gray-200 px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-gray-900">Study Groups</Text>
            <Pressable
              onPress={() => setShowCreateModal(true)}
              className="flex-row items-center gap-2 rounded-lg bg-blue-500 px-4 py-2"
            >
              <FontAwesomeIcon icon={faPlus as IconProp} size={16} color="white" />
              <Text className="font-semibold text-white">Create</Text>
            </Pressable>
          </View>
        </View>

        {/* Tabs */}
        <View className="border-b border-gray-200 px-4">
          <View className="flex-row gap-4">
            {(['MY', 'DISCOVER', 'ARCHIVED'] as const).map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} className="border-b-2 py-4">
                <Text
                  className={`font-medium ${
                    tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600'
                  }`}
                >
                  {t === 'MY' ? 'My Groups' : t === 'DISCOVER' ? 'Discover' : 'Archived'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* AI Recommendations (only on MY tab) */}
        {tab === 'MY' && !loading && (
          <View className="border-b border-gray-200 px-4 py-4">
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <FontAwesomeIcon icon={faWandSparkles as IconProp} size={18} color="#2f64f6" />
                <Text className="text-lg font-semibold text-gray-900">AI-Suggested Groups For You</Text>
              </View>
              {recommendedGroups.length === 0 && !isLoadingRecommendations ? (
                <Pressable
                  onPress={handleGetRecommendations}
                  className="mt-2 flex-row items-center gap-2 self-start rounded-lg bg-blue-100 px-3 py-2"
                >
                  <Text className="text-sm font-medium text-blue-600">Get recommendations</Text>
                </Pressable>
              ) : isLoadingRecommendations ? (
                <ActivityIndicator size="small" color="#2f64f6" />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mt-2 gap-3"
                  contentContainerStyle={{ gap: 12 }}
                >
                  {recommendedGroups.map((group) => (
                    <Pressable
                      key={group.id}
                      onPress={() => navigation.navigate('StudyGroupDetail', { groupId: group.id })}
                      className="w-80 rounded-lg border border-gray-200 bg-gray-50 p-4"
                    >
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1">
                          <Text className="text-lg font-semibold text-gray-900">{group.name}</Text>
                          <Text className="mt-1 text-sm text-gray-600">{group.description}</Text>
                        </View>
                        <View className="items-center gap-1 rounded-lg bg-blue-100 px-2 py-1 ml-2">
                          <Text className="text-xs font-bold text-blue-600">
                            {Math.round(group.score * 100)}%
                          </Text>
                          <Text className="text-xs text-blue-600">match</Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        )}

        {/* Search */}
        <View className="border-b border-gray-200 px-4 py-4">
          <TextInput
            placeholder="Search groups..."
            value={searchText}
            onChangeText={setSearchText}
            className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900"
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Content */}
        {errorMessage && (
          <View className="mx-4 my-4 rounded-lg bg-red-50 p-3">
            <Text className="text-sm text-red-700">{errorMessage}</Text>
          </View>
        )}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2f64f6" />
          </View>
        ) : filteredGroups.length === 0 ? (
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}
            className="flex-1"
          >
            <Text className="text-center text-gray-500">
              {searchText ? 'No groups match your search.' : `No ${tab === 'ARCHIVED' ? 'archived ' : ''}groups yet.`}
            </Text>
          </ScrollView>
        ) : (
          <FlatList
            data={filteredGroups}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item: group }) => (
              <Pressable
                onPress={() => navigation.navigate('StudyGroupDetail', { groupId: group.id })}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-lg font-semibold text-gray-900">{group.name}</Text>
                      <View
                        style={{ backgroundColor: VISIBILITY_COLORS[group.visibility] + '20' }}
                        className="rounded px-2 py-1"
                      >
                        <View className="flex-row items-center gap-1">
                          <FontAwesomeIcon
                            icon={(group.visibility === 'PUBLIC' ? faGlobe : faLock) as IconProp}
                            size={12}
                            color={VISIBILITY_COLORS[group.visibility]}
                          />
                          <Text
                            style={{ color: VISIBILITY_COLORS[group.visibility] }}
                            className="text-xs font-medium"
                          >
                            {group.visibility}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text className="mt-2 text-sm text-gray-600">{group.description}</Text>
                    <View className="mt-3 flex-row items-center gap-4">
                      <Text className="text-xs text-gray-500">{group.memberCount || 0} members</Text>
                      <Text className="text-xs text-gray-500">
                        Created {new Date(group.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <FontAwesomeIcon icon={faChevronRight as IconProp} size={20} color="#d1d5db" />
                </View>
              </Pressable>
            )}
          />
        )}
      </View>

      {/* Create Group Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-1">
            {/* Modal Header */}
            <View className="border-b border-gray-200 px-4 py-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-xl font-bold text-gray-900">Create Group</Text>
                <Pressable onPress={() => setShowCreateModal(false)} className="p-2">
                  <FontAwesomeIcon icon={faX as IconProp} size={24} color="#6b7280" />
                </Pressable>
              </View>
            </View>

            {/* Modal Content */}
            <ScrollView className="flex-1 px-4 py-6" contentContainerStyle={{ gap: 16 }}>
              {createError && (
                <View className="rounded-lg bg-red-50 p-3">
                  <Text className="text-sm text-red-700">{createError}</Text>
                </View>
              )}

              <View>
                <Text className="mb-2 font-medium text-gray-900">Group Name</Text>
                <TextInput
                  placeholder="Enter group name"
                  value={name}
                  onChangeText={setName}
                  editable={!isCreating}
                  className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View>
                <Text className="mb-2 font-medium text-gray-900">Description</Text>
                <TextInput
                  placeholder="Enter group description"
                  value={description}
                  onChangeText={setDescription}
                  editable={!isCreating}
                  multiline
                  numberOfLines={4}
                  className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View>
                <Text className="mb-2 font-medium text-gray-900">Visibility</Text>
                <View className="flex-row gap-3">
                  {(['PUBLIC', 'PRIVATE'] as const).map((v) => (
                    <Pressable
                      key={v}
                      onPress={() => setVisibility(v)}
                      className={`flex-1 rounded-lg border px-4 py-3 ${
                        visibility === v
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      <Text
                        className={`text-center font-medium ${
                          visibility === v ? 'text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        {v}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={handleCreateGroup}
                disabled={!name.trim() || isCreating}
                className={`items-center justify-center rounded-lg py-3 ${
                  name.trim() && !isCreating ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="font-semibold text-white">Create Group</Text>
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

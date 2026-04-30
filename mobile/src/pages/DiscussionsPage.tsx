import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faBell,
  faBridge,
  faChevronDown,
  faComments,
  faPalette,
  faPlus,
  faSearch,
  faSignOutAlt,
  faUser,
  faX,
} from '@fortawesome/free-solid-svg-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MobileBottomNav, type MobileNavTab } from '../components/MobileBottomNav';
import { listThreads, type ThreadPanel, type ThreadSummary } from '../api/threads.api';
import { loadCurrentUserProfile, type CurrentUserProfile } from '../api/profile.api';
import { clearTokens } from '../lib/auth-storage';
import { getValidAccessToken } from '../lib/auth-session';
import type { RootStackParamList } from '../navigation/root-stack';
import CreateDiscussionModal from '../components/threads/CreateDiscussionModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Discussions'>;

export function DiscussionsPage({ navigation }: Props) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [activePanel, setActivePanel] = useState<ThreadPanel>('ACADEMIC');
  const [searchQuery, setSearchQuery] = useState('');
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Determine available panels based on role
  const availablePanels = useMemo(() => {
    return profile?.role === 'ALUMNI' ? (['ALUMNI'] as const) : (['ACADEMIC', 'ALUMNI'] as const);
  }, [profile?.role]);

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

      if (!cancelled) {
        setAccessToken(token);
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [navigation]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const token = accessToken;
    let cancelled = false;

    async function loadProfile() {
      try {
        const userProfile = await loadCurrentUserProfile(token);
        if (!cancelled) {
          setProfile(userProfile);
          // Set initial panel based on user role
          const initialPanel = userProfile.role === 'ALUMNI' ? 'ALUMNI' : 'ACADEMIC';
          setActivePanel(initialPanel);
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const token = accessToken;
    let cancelled = false;

    async function loadThreads() {
      try {
        setLoading(true);
        const response = await listThreads(token, {
          panel: activePanel,
          take: 50,
          sortBy: 'newest',
        });

        if (!cancelled) {
          setThreads(response.threads);
        }
      } catch {
        if (!cancelled) {
          setThreads([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadThreads();

    return () => {
      cancelled = true;
    };
  }, [accessToken, activePanel]);

  async function handleLogout() {
    await clearTokens();
    navigation.replace('Login');
  }

  function navigateBottom(tab: MobileNavTab) {
    if (tab === 'home') {
      navigation.navigate('Dashboard');
      return;
    }

    if (tab === 'discussions') {
      // Already on discussions page
      return;
    }

    if (tab === 'geo-board') {
      // TODO: Navigate to Geo Board
      return;
    }

    if (tab === 'study-groups') {
      navigation.navigate('StudyGroups');
      return;
    }

    if (tab === 'notes') {
      // TODO: Navigate to Notes
      return;
    }
  }

  // Filter threads by search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) {
      return threads;
    }

    const query = searchQuery.toLowerCase();
    return threads.filter(
      (thread) =>
        thread.title.toLowerCase().includes(query) ||
        (thread.description?.toLowerCase().includes(query) ?? false) ||
        (thread.authorName?.toLowerCase().includes(query) ?? false),
    );
  }, [threads, searchQuery]);

  const profileInitials = useMemo(() => {
    if (!profile?.profile) return 'JD';
    const name = `${profile.profile.firstName} ${profile.profile.lastName}`.trim();
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [profile]);

  const panelLabel =
    activePanel === 'ACADEMIC'
      ? 'Academic Discussions'
      : activePanel === 'ALUMNI'
        ? 'Alumni Network'
        : 'Career Advice';

  const panelDescription =
    activePanel === 'ACADEMIC'
      ? 'A space for students and professors to discuss coursework, research, and academic topics.'
      : activePanel === 'ALUMNI'
        ? 'Connect with alumni members and share experiences.'
        : 'Discuss career paths, job opportunities, and professional growth.';

  return (
    <SafeAreaView className="flex-1 bg-[#f5f8ff]" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      <View className="flex-1">
        {/* Header */}
        <View className="min-h-[72px] flex-row items-center justify-between border-b border-[#e6edf7] bg-white px-4">
          <View className="flex-row items-center gap-2">
            <View className="h-9 w-9 items-center justify-center rounded-[12px] bg-[#2f64f6]">
              <FontAwesomeIcon icon={faBridge as IconProp} size={18} color="white" />
            </View>
            <Text className="text-[18px] font-extrabold tracking-[-0.03em] text-[#101c33]">UniBridge</Text>
          </View>

          <View className="flex-row items-center gap-2">
            <IconButton icon={faPalette as IconProp} onPress={() => {}} />
            <IconButton icon={faBell as IconProp} onPress={() => {}} />
            <Pressable
              onPress={() => setIsAccountMenuOpen(true)}
              className="h-9 flex-row items-center gap-2 rounded-full bg-[#eaf1ff] pl-1 pr-3"
            >
              <View className="h-7 w-7 items-center justify-center rounded-full bg-white">
                <Text className="text-[11px] font-extrabold text-[#2f64f6]">{profileInitials}</Text>
              </View>
              <FontAwesomeIcon icon={faChevronDown as IconProp} size={11} color="#6a7b98" />
            </Pressable>
          </View>
        </View>

        {/* Account Menu Modal */}
        <Modal
          visible={isAccountMenuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsAccountMenuOpen(false)}
        >
          <Pressable className="flex-1 bg-black/20 px-4" onPress={() => setIsAccountMenuOpen(false)}>
            <View className="mt-20 self-end w-48 overflow-hidden rounded-3xl border border-[#dfe8f4] bg-white shadow-lg">
              <Pressable
                onPress={() => {
                  setIsAccountMenuOpen(false);
                  navigation.navigate('Profile');
                }}
                className="flex-row items-center gap-3 px-4 py-4"
              >
                <FontAwesomeIcon icon={faUser as IconProp} size={14} color="#2f64f6" />
                <Text className="text-sm font-semibold text-[#13233e]">Visit Profile</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsAccountMenuOpen(false);
                  void handleLogout();
                }}
                className="flex-row items-center gap-3 border-t border-[#eef3fa] px-4 py-4"
              >
                <FontAwesomeIcon icon={faSignOutAlt as IconProp} size={14} color="#d24f4f" />
                <Text className="text-sm font-semibold text-[#d24f4f]">Log out</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Main Content */}
        <ScrollView contentContainerClassName="pb-28" showsVerticalScrollIndicator={false}>
          {/* Title Section */}
          <View className="border-b border-[#e6edf7] bg-white px-4 py-5">
            <Text className="text-2xl font-extrabold tracking-[-0.03em] text-[#101d36]">Discussions</Text>
            <Text className="mt-2 text-sm leading-5 text-[#5f7291]">
              Join conversations with your academic community
            </Text>
          </View>

          {/* New Discussion Button */}
          <View className="px-4 pt-4">
            <Pressable onPress={() => setShowCreateModal(true)} className="flex-row items-center justify-center gap-2 rounded-[24px] bg-[#2f64f6] px-4 py-3.5">
              <FontAwesomeIcon icon={faPlus as IconProp} size={18} color="white" />
              <Text className="text-base font-bold text-white">New Discussion</Text>
            </Pressable>
          </View>

          {/* Panel Tabs */}
          {availablePanels.length > 1 && (
            <View className="mt-4 flex-row gap-2 px-4">
              {availablePanels.map((panel) => {
                const isActive = panel === activePanel;
                const tabLabel = panel === 'ACADEMIC' ? 'Academic Discussions' : 'Career Advice';
                const tabIcon = panel === 'ACADEMIC' ? faComments : faPalette;

                return (
                  <Pressable
                    key={panel}
                    onPress={() => {
                      setActivePanel(panel);
                      setSearchQuery('');
                    }}
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl px-3.5 py-2.5 ${
                      isActive
                        ? 'border border-[#2f64f6] bg-[#eaf1ff]'
                        : 'border border-[#dde6f5] bg-white'
                    }`}
                  >
                    <FontAwesomeIcon
                      icon={tabIcon as IconProp}
                      size={13}
                      color={isActive ? '#2f64f6' : '#6a7b98'}
                    />
                    <Text
                      className={`text-sm font-semibold ${
                        isActive ? 'text-[#2f64f6]' : 'text-[#5f7291]'
                      }`}
                      numberOfLines={1}
                    >
                      {tabLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Panel Description */}
          <View className="mt-4 px-4">
            <View className="flex-row items-start gap-3 rounded-2xl bg-[#f0f4ff] p-3.5">
              <View className="h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[#dbe8ff]">
                <FontAwesomeIcon icon={faComments as IconProp} size={16} color="#2f64f6" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-[#101d36]">{panelLabel}</Text>
                <Text className="mt-1 text-xs leading-4 text-[#5f7291]">{panelDescription}</Text>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          <View className="mt-4 px-4">
            <View className="flex-row items-center rounded-2xl border border-[#dde6f5] bg-white pl-3 pr-2.5">
              <FontAwesomeIcon icon={faSearch as IconProp} size={14} color="#9ca3af" />
              <TextInput
                placeholder="Search discussions..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="ml-2.5 flex-1 py-2.5 text-sm text-[#1f2937]"
                placeholderTextColor="#9ca3af"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} className="p-1">
                  <FontAwesomeIcon icon={faX as IconProp} size={12} color="#9ca3af" />
                </Pressable>
              )}
            </View>
          </View>

          {/* Threads List */}
          <View className="mt-4 px-4">
            {loading ? (
              <View className="items-center justify-center py-8">
                <Text className="text-sm font-semibold text-[#7182a0]">Loading discussions...</Text>
              </View>
            ) : filteredThreads.length === 0 ? (
              <View className="items-center justify-center rounded-2xl border border-dashed border-[#d8e2f4] bg-[#fafcff] px-4 py-8">
                <Text className="text-sm font-semibold text-[#7182a0]">
                  {searchQuery.trim() ? 'No discussions match your search' : 'No discussions yet. Start one!'}
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {filteredThreads.map((thread) => (
                  <DiscussionThreadItem key={thread.id} thread={thread} onPress={() => navigation.navigate('ThreadDetail', { threadId: thread.id })} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View className="bg-white">
          <MobileBottomNav activeTab="discussions" onNavigate={navigateBottom} />
        </View>
      </View>

      {/* Create Discussion Modal */}
      <CreateDiscussionModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        panel={activePanel}
        token={accessToken}
        onCreated={async () => {
          if (!accessToken) return;
          const response = await listThreads(accessToken, {
            panel: activePanel,
            take: 50,
            sortBy: 'newest',
          });
          setThreads(response.threads);
        }}
      />
    </SafeAreaView>
  );
}

function DiscussionThreadItem({ thread, onPress }: { thread: ThreadSummary; onPress: () => void }) {
  const authorInitial = (thread.authorName || 'U').charAt(0).toUpperCase();
  const panelBgColor = thread.panel === 'ALUMNI' ? 'bg-[#fff3df]' : 'bg-[#e7efff]';
  const panelTextColor = thread.panel === 'ALUMNI' ? 'text-[#b86b00]' : 'text-[#2452c2]';

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-2xl border border-[#e6edf8] bg-white"
    >
      {/* Thread Header */}
      <View className="flex-row items-start gap-3 p-3.5">
        <View className="h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#dbe8ff]">
          <Text className="text-sm font-bold text-[#2f64f6]">{authorInitial}</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-sm font-bold text-[#16233f]">{thread.authorName || 'UniBridge User'}</Text>
            <View className={`rounded-full px-2 py-[2px] ${panelBgColor}`}>
              <Text className={`text-[10px] font-bold uppercase ${panelTextColor}`}>
                {thread.panel === 'ALUMNI' ? 'alumni' : 'academic'}
              </Text>
            </View>
            <Text className="text-xs font-medium text-[#8796af]">{formatRelativeDate(thread.updatedAt)}</Text>
          </View>

          {/* Title */}
          <Text
            className="mt-2 text-[15px] font-semibold leading-5 text-[#182842]"
            numberOfLines={2}
          >
            {thread.title}
          </Text>

          {/* Description Preview */}
          {thread.description && (
            <Text
              className="mt-1 text-sm leading-5 text-[#5f7090]"
              numberOfLines={2}
            >
              {thread.description}
            </Text>
          )}

          {/* Meta Information */}
          <View className="mt-2.5 flex-row items-center gap-1.5">
            <Text className="text-[12px] font-medium text-[#8796af]">
              {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function IconButton({ icon, onPress }: { icon: IconProp; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-full border border-[#dde6f5] bg-white"
    >
      <FontAwesomeIcon icon={icon} size={14} color="#607293" />
    </Pressable>
  );
}

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) {
    return 'just now';
  }

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

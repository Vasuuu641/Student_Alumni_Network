import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faBell,
  faBridge,
  faBookOpen,
  faBriefcase,
  faChevronDown,
  faComments,
  faPalette,
  faUser,
  faUsers,
  faCompass,
  faSignOutAlt,
} from '@fortawesome/free-solid-svg-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MobileBottomNav, type MobileNavTab } from '../components/MobileBottomNav';
import { listStudyGroups } from '../api/study-groups.api';
import { listThreads, type ThreadSummary } from '../api/threads.api';
import { listUserNotes } from '../api/notes.api';
import { loadCurrentUserProfile, type CurrentUserProfile } from '../api/profile.api';
import { clearTokens, getAccessToken } from '../lib/auth-storage';
import { API_BASE_URL } from '../lib/api';
import type { RootStackParamList } from '../navigation/root-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

type DashboardNotice = string | null;

export function DashboardPage({ navigation }: Props) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profileBundle, setProfileBundle] = useState<CurrentUserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [notesCount, setNotesCount] = useState(0);
  const [discussionCount, setDiscussionCount] = useState(0);
  const [studyGroupsCount, setStudyGroupsCount] = useState(0);
  const [recentDiscussions, setRecentDiscussions] = useState<ThreadSummary[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [notice, setNotice] = useState<DashboardNotice>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const token = await getAccessToken();

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

    async function loadDashboard() {
      try {
        setProfileLoading(true);
        const profile = await loadCurrentUserProfile(token);

        if (cancelled) {
          return;
        }

        setProfileBundle(profile);

        const panels = profile.role === 'ALUMNI' ? ['ALUMNI'] as const : ['ACADEMIC', 'ALUMNI'] as const;

        setStatsLoading(true);

        const [notesResponse, studyGroupsResponse, ...threadResponses] = await Promise.all([
          listUserNotes(token),
          profile.role === 'ALUMNI' ? Promise.resolve([]) : listStudyGroups(token),
          ...panels.map((panel) => listThreads(token, { panel, take: 25, sortBy: 'newest' })),
        ]);

        if (cancelled) {
          return;
        }

        setNotesCount(notesResponse.length);
        setStudyGroupsCount(studyGroupsResponse.filter((group) => group.status !== 'DELETED').length);
        setDiscussionCount(threadResponses.reduce((sum, response) => sum + response.total, 0));
        setRecentDiscussions(
          threadResponses
            .flatMap((response) => response.threads)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 3),
        );
      } catch {
        if (!cancelled) {
          setProfileBundle(null);
          setNotesCount(0);
          setDiscussionCount(0);
          setStudyGroupsCount(0);
          setRecentDiscussions([]);
          setNotice('Unable to load your dashboard right now.');
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
          setStatsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  function openNotice(message: string) {
    setNotice(message);
  }

  function navigateBottom(tab: MobileNavTab) {
    if (tab === 'home') {
      navigation.navigate('Dashboard');
      return;
    }

    if (tab === 'discussions') {
      navigation.navigate('Discussions');
      return;
    }

    if (tab === 'geo-board') {
      openNotice('Geo Help Board will be added in the next mobile update.');
      return;
    }

    if (tab === 'study-groups') {
      openNotice('Study Groups will be added in the next mobile update.');
      return;
    }

    if (tab === 'notes') {
      openNotice('Notes will be added in the next mobile update.');
      return;
    }
  }

  async function handleLogout() {
    await clearTokens();
    navigation.replace('Login');
  }

  const profile = profileBundle?.profile ?? null;
  const role = profileBundle?.role ?? null;
  const displayName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'John Doe';
  const firstName = displayName.split(' ')[0] || 'John';
  const roleBadge = role ? role.charAt(0) + role.slice(1).toLowerCase() : 'Student';
  const profilePictureSrc = resolveProfilePictureUrl(profile?.profilePictureUrl ?? null);
  const profileInitials = useMemo(
    () =>
      displayName
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
    [displayName],
  );
  const profileHeadline = buildProfileHeadline(profile, role);

  return (
    <SafeAreaView className="flex-1 bg-[#f5f8ff]" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      <View className="flex-1">
        <View className="min-h-[72px] flex-row items-center justify-between border-b border-[#e6edf7] bg-white px-4">
          <View className="flex-row items-center gap-2">
            <View className="h-9 w-9 items-center justify-center rounded-[12px] bg-[#2f64f6]">
              <FontAwesomeIcon icon={faBridge as IconProp} size={18} color="white" />
            </View>
            <Text className="text-[18px] font-extrabold tracking-[-0.03em] text-[#101c33]">UniBridge</Text>
          </View>

          <View className="flex-row items-center gap-2">
            <IconButton icon={faPalette as IconProp} onPress={() => openNotice('Theme settings will be available soon.')} />
            <IconButton icon={faBell as IconProp} onPress={() => openNotice('Notifications will be available soon.')} />
            <Pressable
              onPress={() => setIsAccountMenuOpen(true)}
              className="h-9 flex-row items-center gap-2 rounded-full bg-[#eaf1ff] pl-1 pr-3"
            >
              <View className="h-7 w-7 items-center justify-center rounded-full bg-white">
                <Text className="text-[11px] font-extrabold text-[#2f64f6]">{profileInitials || 'JD'}</Text>
              </View>
              <FontAwesomeIcon icon={faChevronDown as IconProp} size={11} color="#6a7b98" />
            </Pressable>
          </View>
        </View>

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

        <ScrollView contentContainerClassName="px-4 pb-36 pt-4" showsVerticalScrollIndicator={false}>
          {notice ? (
            <View className="mb-3 rounded-2xl border border-[#f7d89a] bg-[#fff7e6] px-4 py-3">
              <Text className="text-sm font-semibold text-[#8d5800]">{notice}</Text>
            </View>
          ) : null}

          <View className="mb-4 rounded-[28px] border border-[#e4ecfb] bg-[#f3f7ff] px-4 py-5">
            <View className="mb-3 self-start rounded-full border border-[#d7e4ff] bg-white px-3 py-1.5">
              <Text className="text-[11px] font-bold text-[#2d58a7]">✨ Built for universities</Text>
            </View>

            <Text className="text-[28px] font-extrabold leading-[34px] tracking-[-0.04em] text-[#101d36]">
              Welcome back, {firstName}!
            </Text>
            <Text className="mt-2 text-[15px] leading-6 text-[#5f7291]">
              Here&apos;s what&apos;s happening in your academic community
            </Text>

            <Pressable
              onPress={() => navigation.navigate('Profile')}
              className="mt-4 flex-row items-center justify-between rounded-2xl border border-[#dce7fb] bg-white px-4 py-3"
            >
              <View>
                <Text className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6d7fa1]">Quick access</Text>
                <Text className="mt-1 text-sm font-bold text-[#13233e]">Open your profile</Text>
              </View>
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf1ff]">
                <FontAwesomeIcon icon={faUser as IconProp} size={15} color="#2f64f6" />
              </View>
            </Pressable>
          </View>

          <View className="gap-3">
            <DashboardStatCard
              title="Your Notes"
              value={statsLoading ? '...' : String(notesCount)}
              accent="blue"
              icon={faBookOpen as IconProp}
              actionLabel="View all notes"
              onPress={() => openNotice('Notes will be added in the next mobile update.')}
            />

            <DashboardStatCard
              title="Discussions"
              value={statsLoading ? '...' : String(discussionCount)}
              accent="gold"
              icon={faComments as IconProp}
              actionLabel="Join discussions"
              onPress={() => openNotice('Discussions will be added in the next mobile update.')}
            />

            <DashboardStatCard
              title="Study Groups"
              value={statsLoading ? '...' : String(studyGroupsCount)}
              accent="green"
              icon={faUsers as IconProp}
              actionLabel="Browse groups"
              onPress={() => openNotice('Groups will be added in the next mobile update.')} />
          </View>

          <View className="mt-4 rounded-[26px] border border-[#e3ebf7] bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[20px] font-extrabold tracking-[-0.03em] text-[#101d36]">Quick Actions</Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <ActionPill icon={faBookOpen as IconProp} label="Notes" tone="blue" onPress={() => openNotice('Notes will be added in the next mobile update.')} />
              <ActionPill icon={faComments as IconProp} label="Discussions" tone="gold" onPress={() => navigation.navigate('Discussions')} />
              <ActionPill icon={faUsers as IconProp} label="Groups" tone="green" onPress={() => openNotice('Groups will be added in the next mobile update.')} />
              <ActionPill icon={faCompass as IconProp} label="Geo Board" tone="purple" onPress={() => openNotice('Geo board will be added in the next mobile update.')} />
            </View>
          </View>

          <View className="mt-4 rounded-[26px] border border-[#e3ebf7] bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[20px] font-extrabold tracking-[-0.03em] text-[#101d36]">Recent Discussions</Text>
              <Pressable onPress={() => openNotice('Discussion details will be added in the next mobile update.')}>
                <Text className="text-sm font-semibold text-[#2f64f6]">View all</Text>
              </Pressable>
            </View>

            <View className="gap-3">
              {recentDiscussions.length === 0 ? (
                <View className="rounded-2xl border border-dashed border-[#d8e2f4] bg-[#fafcff] px-4 py-4">
                  <Text className="text-sm font-semibold text-[#7182a0]">No discussions yet. Start one from Discussions.</Text>
                </View>
              ) : (
                recentDiscussions.map((thread) => (
                  <View key={thread.id} className="flex-row gap-3 rounded-2xl border border-[#e6edf8] bg-[#f9fbff] p-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-[#dbe8ff]">
                      <Text className="text-sm font-bold text-[#2f64f6]">{thread.authorName?.charAt(0).toUpperCase() || 'U'}</Text>
                    </View>
                    <View className="flex-1">
                      <View className="mb-1 flex-row flex-wrap items-center gap-2">
                        <Text className="text-sm font-bold text-[#16233f]">{thread.authorName || 'UniBridge User'}</Text>
                        <View className={`rounded-full px-2 py-[2px] ${thread.panel === 'ALUMNI' ? 'bg-[#fff3df]' : 'bg-[#e7efff]'}`}>
                          <Text className={`text-[10px] font-bold uppercase ${thread.panel === 'ALUMNI' ? 'text-[#b86b00]' : 'text-[#2452c2]'}`}>
                            {thread.panel === 'ALUMNI' ? 'alumni' : 'academic'}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-[15px] font-semibold leading-5 text-[#182842]">{thread.title}</Text>
                      <Text className="mt-1 text-sm leading-5 text-[#5f7090]">
                        {thread.description || 'Open the discussion to see full details and replies.'}
                      </Text>
                      <Text className="mt-2 text-[12px] font-medium text-[#8796af]">
                        {formatRelativeDate(thread.updatedAt)} • {thread.replyCount} comments
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>

          <View className="mt-4 overflow-hidden rounded-[28px] border border-[#e3ebf7] bg-white">
            <View className="h-[92px] bg-[#2f64f6]" />
            <View className="-mt-11 px-4 pb-4">
              <View className="h-[88px] w-[88px] items-center justify-center self-start rounded-full border-[4px] border-white bg-[#dce8ff] shadow-sm">
                {profileLoading ? (
                  <Text className="text-[22px] font-extrabold text-[#2f64f6]">...</Text>
                ) : profilePictureSrc ? (
                  <Image
                    source={{ uri: profilePictureSrc }}
                    className="h-full w-full rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Text className="text-[24px] font-extrabold text-[#2f64f6]">{profileInitials || 'JD'}</Text>
                )}
              </View>

              <Text className="mt-3 text-[18px] font-extrabold tracking-[-0.03em] text-[#10213a]">{displayName}</Text>
              <Text className="mt-1 text-[14px] leading-5 text-[#5f7090]">{profileHeadline}</Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                <View className="rounded-full bg-[#eef4ff] px-3 py-1">
                  <Text className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#2f64f6]">{roleBadge}</Text>
                </View>
                {profile?.faculty ? (
                  <View className="rounded-full bg-[#f2f6fd] px-3 py-1">
                    <Text className="text-[11px] font-semibold text-[#61738f]">{profile.faculty}</Text>
                  </View>
                ) : null}
              </View>

              <Pressable
                onPress={() => navigation.navigate('Profile')}
                className="mt-4 items-center justify-center rounded-2xl border border-[#d8e2f4] bg-white px-4 py-3"
              >
                <Text className="text-sm font-bold text-[#16233f]">View Profile</Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-4 rounded-[26px] border border-[#e3ebf7] bg-white p-4">
            <View className="flex-row items-start gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#f3e9ff]">
                <FontAwesomeIcon icon={faBriefcase as IconProp} size={15} color="#8b45f7" />
              </View>
              <View className="flex-1">
                <Text className="text-[18px] font-extrabold tracking-[-0.03em] text-[#101d36]">Smart Notes</Text>
                <Text className="mt-1 text-sm font-semibold text-[#7b45d9]">AI-Powered</Text>
                <Text className="mt-2 text-sm leading-5 text-[#5f7090]">
                  Write notes and discover related discussions from your academic community in real time.
                </Text>
                <Pressable
                  onPress={() => openNotice('Smart Notes will be added in the next mobile update.')}
                  className="mt-3 self-start rounded-2xl bg-[#2f64f6] px-4 py-2.5"
                >
                  <Text className="text-sm font-bold text-white">Try Smart Notes</Text>
                </Pressable>
              </View>
            </View>
          </View>

        </ScrollView>

        <View className="bg-white">
          <MobileBottomNav activeTab="home" onNavigate={navigateBottom} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function DashboardStatCard({
  title,
  value,
  icon,
  actionLabel,
  accent,
  onPress,
}: {
  title: string;
  value: string;
  icon: IconProp;
  actionLabel: string;
  accent: 'blue' | 'gold' | 'green';
  onPress: () => void;
}) {
  const accentClass =
    accent === 'gold'
      ? 'bg-[#fff4db] text-[#c07400]'
      : accent === 'green'
        ? 'bg-[#e5f9eb] text-[#21894b]'
        : 'bg-[#eaf1ff] text-[#2f64f6]';
  const iconColor = accent === 'gold' ? '#c07400' : accent === 'green' ? '#21894b' : '#2f64f6';

  return (
    <Pressable onPress={onPress} className="rounded-[26px] border border-[#e3ebf7] bg-white p-4">
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-[#6f829f]">{title}</Text>
          <Text className="mt-2 text-[30px] font-extrabold tracking-[-0.05em] text-[#0f1e37]">{value}</Text>
          <Text className="mt-3 text-sm font-semibold text-[#2f64f6]">{actionLabel} →</Text>
        </View>
        <View className={`h-12 w-12 items-center justify-center rounded-2xl ${accentClass}`}>
          <FontAwesomeIcon icon={icon} size={16} color={iconColor} />
        </View>
      </View>
    </Pressable>
  );
}

function ActionPill({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: IconProp;
  label: string;
  tone: 'blue' | 'gold' | 'green' | 'purple';
  onPress: () => void;
}) {
  const toneClass =
    tone === 'gold'
      ? 'bg-[#fff4db] text-[#c07400]'
      : tone === 'green'
        ? 'bg-[#e5f9eb] text-[#21894b]'
        : 'bg-[#eaf1ff] text-[#2f64f6]';
  const iconColor = tone === 'gold' ? '#c07400' : tone === 'green' ? '#21894b' : tone === 'purple' ? '#8b45f7' : '#2f64f6';

  return (
    <Pressable onPress={onPress} className="min-w-[47%] flex-1 flex-row items-center gap-3 rounded-2xl border border-[#e5ecf7] bg-[#f8fbff] px-3 py-3">
      <View className={`h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}>
        <FontAwesomeIcon icon={icon} size={14} color={iconColor} />
      </View>
      <Text className="flex-1 text-sm font-semibold text-[#344766]">{label}</Text>
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

function resolveProfilePictureUrl(profilePictureUrl?: string | null): string | null {
  if (!profilePictureUrl) {
    return null;
  }

  const normalizedUrl = profilePictureUrl.replace(/\\/g, '/');

  if (
    normalizedUrl.startsWith('http://') ||
    normalizedUrl.startsWith('https://') ||
    normalizedUrl.startsWith('data:')
  ) {
    return normalizedUrl;
  }

  const uploadsSegment = '/uploads/';
  const uploadsIndex = normalizedUrl.indexOf(uploadsSegment);
  const normalizedPath = uploadsIndex >= 0
    ? normalizedUrl.slice(uploadsIndex)
    : normalizedUrl.startsWith('uploads/')
      ? `/${normalizedUrl}`
      : normalizedUrl.startsWith('/')
        ? normalizedUrl
        : `/${normalizedUrl}`;

  return `${API_BASE_URL}${normalizedPath}`;
}

function buildProfileHeadline(profile: CurrentUserProfile['profile'] | null, role: CurrentUserProfile['role'] | null): string {
  const headlineParts = [profile?.major?.trim(), profile?.jobTitle?.trim(), profile?.company?.trim()].filter(Boolean);

  if (headlineParts.length > 0) {
    return headlineParts.join(' | ');
  }

  if (role === 'ALUMNI') {
    return 'Alumni member at UniBridge';
  }

  if (role === 'PROFESSOR') {
    return 'Professor at UniBridge';
  }

  return 'Computer Science Student | ML Enthusiast';
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
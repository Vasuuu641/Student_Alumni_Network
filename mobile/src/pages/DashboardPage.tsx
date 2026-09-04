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
import { clearTokens } from '../lib/auth-storage';
import { API_BASE_URL } from '../lib/api';
import { getValidAccessToken } from '../lib/auth-session';
import { getRoleFromAccessToken } from '../lib/jwt';
import type { RootStackParamList } from '../navigation/root-stack';
import { useTheme, useThemePicker } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

type DashboardNotice = string | null;

export function DashboardPage({ navigation }: Props) {
  const { tokens } = useTheme();
  const { openThemePicker } = useThemePicker();
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
      const token = await getValidAccessToken();

      if (cancelled) {
        return;
      }

      if (!token) {
        navigation.replace('Home');
        return;
      }

      if (getRoleFromAccessToken(token) === 'ADMIN') {
        navigation.replace('AdminLayout');
        return;
      }

      setAccessToken(token);
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

        const [{ notes: userNotes }, studyGroupsResponse, ...threadResponses] = await Promise.all([
          listUserNotes(token),
          profile.role === 'ALUMNI' ? Promise.resolve([]) : listStudyGroups(token),
          ...panels.map((panel) => listThreads(token, { panel, take: 25, sortBy: 'newest' })),
        ]);

        if (cancelled) {
          return;
        }

        setNotesCount(userNotes.length);
        setStudyGroupsCount(studyGroupsResponse.filter((group) => group.status !== 'DELETED').length);
        setDiscussionCount(threadResponses.reduce((sum, response) => sum + response.total, 0));
        setRecentDiscussions(
          threadResponses
            .flatMap((response) => response.threads)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 3),
        );
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : '';
          const isAuthFailure =
            message.includes('Unauthorized') ||
            message.includes('expired token') ||
            message.includes('Missing Authorization header') ||
            message.includes('Invalid Authorization header');

          if (isAuthFailure) {
            await clearTokens();
            navigation.replace('Home');
            return;
          }

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
      navigation.navigate('GeoHelpBoard');
      return;
    }

    if (tab === 'study-groups') {
      navigation.navigate('StudyGroups');
      return;
    }

    if (tab === 'notes') {
      navigation.navigate('Notes');
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
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <StatusBar style={tokens.name === 'midnight' ? 'light' : 'dark'} />

      <View className="flex-1">
        <View className="min-h-[72px] flex-row items-center justify-between border-b border-[#e6edf7] bg-white px-4" style={{ backgroundColor: tokens.surface, borderBottomColor: tokens.border }}>
          <View className="flex-row items-center gap-2">
            <View className="h-9 w-9 items-center justify-center rounded-[12px]" style={{ backgroundColor: tokens.primary }}>
              <FontAwesomeIcon icon={faBridge as IconProp} size={18} color="white" />
            </View>
            <Text className="text-[18px] font-extrabold tracking-[-0.03em] text-[#101c33]" style={{ color: tokens.text }}>UniBridge</Text>
          </View>

          <View className="flex-row items-center gap-2">
            <IconButton icon={faPalette as IconProp} onPress={openThemePicker} />
            <IconButton icon={faBell as IconProp} onPress={() => openNotice('Notifications will be available soon.')} />
            <Pressable
              onPress={() => setIsAccountMenuOpen(true)}
              className="h-9 flex-row items-center gap-2 rounded-full bg-[#eaf1ff] pl-1 pr-3"
              style={{ backgroundColor: tokens.primarySoft }}
            >
              <View className="h-7 w-7 items-center justify-center rounded-full bg-white">
                <Text className="text-[11px] font-extrabold text-[#2f64f6]" style={{ color: tokens.primary }}>{profileInitials || 'JD'}</Text>
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
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 16 }} onPress={() => setIsAccountMenuOpen(false)}>
            <View style={{ marginTop: 80, alignSelf: 'flex-end', width: 192, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}>
              <Pressable
                onPress={() => {
                  setIsAccountMenuOpen(false);
                  navigation.navigate('Profile');
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 }}
              >
                <FontAwesomeIcon icon={faUser as IconProp} size={14} color={tokens.primary} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.text }}>Visit Profile</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsAccountMenuOpen(false);
                  void handleLogout();
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: tokens.border, paddingHorizontal: 16, paddingVertical: 16 }}
              >
                <FontAwesomeIcon icon={faSignOutAlt as IconProp} size={14} color={tokens.danger} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.danger }}>Log out</Text>
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

          <View className="mb-4 rounded-[28px] border border-[#e4ecfb] bg-[#f3f7ff] px-4 py-5" style={{ backgroundColor: tokens.primarySoft, borderColor: tokens.border }}>
            <View className="mb-3 self-start rounded-full border border-[#d7e4ff] bg-white px-3 py-1.5">
              <Text className="text-[11px] font-bold text-[#2d58a7]" style={{ color: tokens.primaryStrong }}>✨ Built for universities</Text>
            </View>

            <Text className="text-[28px] font-extrabold leading-[34px] tracking-[-0.04em] text-[#101d36]" style={{ color: tokens.text }}>
              Welcome back, {firstName}!
            </Text>
            <Text className="mt-2 text-[15px] leading-6 text-[#5f7291]" style={{ color: tokens.muted }}>
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
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf1ff]" style={{ backgroundColor: tokens.primarySoft }}>
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
              onPress={() => navigation.navigate('Notes')}
            />

            <DashboardStatCard
              title="Discussions"
              value={statsLoading ? '...' : String(discussionCount)}
              accent="gold"
              icon={faComments as IconProp}
              actionLabel="Join discussions"
              onPress={() => navigation.navigate('Discussions')}
            />

            <DashboardStatCard
              title="Study Groups"
              value={statsLoading ? '...' : String(studyGroupsCount)}
              accent="green"
              icon={faUsers as IconProp}
              actionLabel="Browse groups"
              onPress={() => navigation.navigate('StudyGroups')} />
          </View>

            <View className="mt-4 rounded-[26px] border border-[#e3ebf7] bg-white p-4" style={{ backgroundColor: tokens.surface, borderColor: tokens.border }}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[20px] font-extrabold tracking-[-0.03em] text-[#101d36]" style={{ color: tokens.text }}>Quick Actions</Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <ActionPill icon={faBookOpen as IconProp} label="Notes" tone="blue" onPress={() => navigation.navigate('Notes')} />
              <ActionPill icon={faComments as IconProp} label="Discussions" tone="gold" onPress={() => navigation.navigate('Discussions')} />
              <ActionPill icon={faUsers as IconProp} label="Groups" tone="green" onPress={() => navigation.navigate('StudyGroups')} />
              <ActionPill icon={faCompass as IconProp} label="Geo Board" tone="purple" onPress={() => navigation.navigate('GeoHelpBoard')} />
            </View>
          </View>

          <View className="mt-4 rounded-[26px] border border-[#e3ebf7] bg-white p-4" style={{ backgroundColor: tokens.surface, borderColor: tokens.border }}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[20px] font-extrabold tracking-[-0.03em] text-[#101d36]" style={{ color: tokens.text }}>Recent Discussions</Text>
              <Pressable onPress={() => navigation.navigate('Discussions')}>
                <Text className="text-sm font-semibold text-[#2f64f6]" style={{ color: tokens.primary }}>View all</Text>
              </Pressable>
            </View>

            <View style={{ gap: 12 }}>
              {recentDiscussions.length === 0 ? (
                <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 16, paddingVertical: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.muted }}>No discussions yet. Start one from Discussions.</Text>
                </View>
              ) : (
                recentDiscussions.map((thread) => (
                  <View key={thread.id} style={{ flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, padding: 12 }}>
                    <View style={{ height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: tokens.primarySoft }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.primary }}>{thread.authorName?.charAt(0).toUpperCase() || 'U'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ marginBottom: 4, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.text }}>{thread.authorName || 'UniBridge User'}</Text>
                        <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: thread.panel === 'ALUMNI' ? tokens.accentSoft : tokens.primarySoft }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: thread.panel === 'ALUMNI' ? tokens.accent : tokens.primary }}>
                            {thread.panel === 'ALUMNI' ? 'alumni' : 'academic'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '600', lineHeight: 20, color: tokens.text }}>{thread.title}</Text>
                      <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: tokens.muted }}>
                        {thread.description || 'Open the discussion to see full details and replies.'}
                      </Text>
                      <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '500', color: tokens.muted }}>
                        {formatRelativeDate(thread.updatedAt)} • {thread.replyCount} comments
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>

          <View className="mt-4 overflow-hidden rounded-[28px] border border-[#e3ebf7] bg-white" style={{ backgroundColor: tokens.surface, borderColor: tokens.border }}>
            <View className="h-[92px]" style={{ backgroundColor: tokens.primary }} />
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
                  <Text className="text-[24px] font-extrabold text-[#2f64f6]" style={{ color: tokens.primary }}>{profileInitials || 'JD'}</Text>
                )}
              </View>

              <Text className="mt-3 text-[18px] font-extrabold tracking-[-0.03em] text-[#10213a]">{displayName}</Text>
              <Text className="mt-1 text-[14px] leading-5 text-[#5f7090]">{profileHeadline}</Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                <View className="rounded-full bg-[#eef4ff] px-3 py-1" style={{ backgroundColor: tokens.primarySoft }}>
                  <Text className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#2f64f6]" style={{ color: tokens.primary }}>{roleBadge}</Text>
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

          <View className="mt-4 rounded-[26px] border border-[#e3ebf7] bg-white p-4" style={{ backgroundColor: tokens.surface, borderColor: tokens.border }}>
            <View className="flex-row items-start gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#f3e9ff]" style={{ backgroundColor: tokens.primarySoft }}>
                <FontAwesomeIcon icon={faBriefcase as IconProp} size={15} color={tokens.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-[18px] font-extrabold tracking-[-0.03em] text-[#101d36]" style={{ color: tokens.text }}>Smart Notes</Text>
                <Text className="mt-1 text-sm font-semibold text-[#7b45d9]" style={{ color: tokens.primaryStrong }}>AI-Powered</Text>
                <Text className="mt-2 text-sm leading-5 text-[#5f7090]" style={{ color: tokens.muted }}>
                  Write notes and discover related discussions from your academic community in real time.
                </Text>
                <Pressable
                  onPress={() => openNotice('Smart Notes will be added in the next mobile update.')}
                  className="mt-3 self-start rounded-2xl bg-[#2f64f6] px-4 py-2.5"
                  style={{ backgroundColor: tokens.primary }}
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
  const { tokens } = useTheme();
  const iconBg =
    accent === 'gold'
      ? tokens.accentSoft
      : accent === 'green'
        ? (tokens.name === 'midnight' ? '#0d2b1a' : '#e5f9eb')
        : tokens.primarySoft;
  const iconColor =
    accent === 'gold' ? tokens.accent : accent === 'green' ? tokens.success : tokens.primary;

  return (
    <Pressable onPress={onPress} style={{ borderRadius: 26, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.muted }}>{title}</Text>
          <Text style={{ marginTop: 8, fontSize: 30, fontWeight: '800', color: tokens.text }}>{value}</Text>
          <Text style={{ marginTop: 12, fontSize: 14, fontWeight: '600', color: tokens.primary }}>{actionLabel} →</Text>
        </View>
        <View style={{ height: 48, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: iconBg }}>
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
  const { tokens } = useTheme();
  const iconBg =
    tone === 'gold'
      ? tokens.accentSoft
      : tone === 'green'
        ? (tokens.name === 'midnight' ? '#0d2b1a' : '#e5f9eb')
        : tone === 'purple'
          ? tokens.primarySoft
          : tokens.primarySoft;
  const iconColor =
    tone === 'gold' ? tokens.accent
    : tone === 'green' ? tokens.success
    : tone === 'purple' ? tokens.primaryStrong
    : tokens.primary;

  return (
    <Pressable onPress={onPress} style={{ minWidth: '47%', flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 12 }}>
      <View style={{ height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: iconBg }}>
        <FontAwesomeIcon icon={icon} size={14} color={iconColor} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: tokens.text }}>{label}</Text>
    </Pressable>
  );
}

function IconButton({ icon, onPress }: { icon: IconProp; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}
    >
      <FontAwesomeIcon icon={icon} size={14} color={tokens.muted} />
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
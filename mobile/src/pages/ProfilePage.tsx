import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowLeft,
  faBookOpen,
  faBriefcase,
  faBell,
  faChevronDown,
  faCircleInfo,
  faComments,
  faEnvelope,
  faGraduationCap,
  faPalette,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MobileBottomNav, type MobileNavTab } from '../components/MobileBottomNav';
import { clearTokens, getAccessToken } from '../lib/auth-storage';
import { getUserEmail } from '../lib/auth-storage';
import { loadCurrentUserProfile, type CurrentUserProfile } from '../api/profile.api';
import { listThreads, type ThreadSummary } from '../api/threads.api';
import { listUserNotes, type NoteSummary } from '../api/notes.api';
import type { RootStackParamList } from '../navigation/root-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfilePage({ navigation }: Props) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profileBundle, setProfileBundle] = useState<CurrentUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'activity'>('profile');
  const [activityLoading, setActivityLoading] = useState(false);
  const [recentThreads, setRecentThreads] = useState<ThreadSummary[]>([]);
  const [recentNotes, setRecentNotes] = useState<NoteSummary[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailAddress, setEmailAddress] = useState<string | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const [token, storedEmail] = await Promise.all([getAccessToken(), getUserEmail()]);

      if (!token) {
        navigation.replace('Login');
        return;
      }

      if (!cancelled) {
        setAccessToken(token);
        setEmailAddress(storedEmail);
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

    let cancelled = false;

    async function loadProfile() {
      try {
        setIsLoading(true);
        const profile = await loadCurrentUserProfile(accessToken);

        if (!cancelled) {
          setProfileBundle(profile);
        }
      } catch {
        if (!cancelled) {
          setNotice('Unable to load your profile right now.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !profileBundle || activeTab !== 'activity') {
      return;
    }

    let cancelled = false;

    async function loadActivity() {
      try {
        setActivityLoading(true);

        const panels = profileBundle.role === 'ALUMNI' ? ['ALUMNI'] as const : ['ACADEMIC', 'ALUMNI'] as const;
        const [threadResponses, noteResponse] = await Promise.all([
          Promise.all(panels.map((panel) => listThreads(accessToken, { panel, take: 20, sortBy: 'newest' }))),
          listUserNotes(accessToken),
        ]);

        if (cancelled) {
          return;
        }

        const profileUserId = profileBundle.profile.userId;
        setRecentThreads(
          threadResponses
            .flatMap((response) => response.threads)
            .filter((thread) => thread.authorId === profileUserId)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 6),
        );

        setRecentNotes(
          noteResponse
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 6),
        );
      } catch {
        if (!cancelled) {
          setNotice('Unable to load recent activity right now.');
        }
      } finally {
        if (!cancelled) {
          setActivityLoading(false);
        }
      }
    }

    void loadActivity();

    return () => {
      cancelled = true;
    };
  }, [accessToken, activeTab, profileBundle]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  async function handleLogout() {
    await clearTokens();
    navigation.replace('Login');
  }

  function navigateBottom(tab: MobileNavTab) {
    if (tab === 'home') {
      navigation.navigate('Dashboard');
      return;
    }

    if (tab === 'geo-board') {
      setNotice('Geo Help Board will be added in the next mobile update.');
      return;
    }

    if (tab === 'study-groups') {
      setNotice('Study Groups will be added in the next mobile update.');
      return;
    }

    if (tab === 'notes') {
      setNotice('Notes will be added in the next mobile update.');
      return;
    }

    setNotice('Discussions will be added in the next mobile update.');
  }

  const profile = profileBundle?.profile ?? null;
  const role = profileBundle?.role ?? null;
  const displayName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'John Doe';
  const isAnonymous = Boolean(profile?.isAnonymous);
  const profilePictureSrc = resolveProfilePictureUrl(profile?.profilePictureUrl ?? null);
  const roleLabel = role ? role.charAt(0) + role.slice(1).toLowerCase() : 'User';
  const profileHeadline = useMemo(() => buildProfileHeadline(profile, role), [profile, role]);
  const profileMetaParts = [
    profile?.faculty?.trim() || undefined,
    getGraduationYear(profile) ? `Class of ${getGraduationYear(profile)}` : undefined,
  ].filter(Boolean) as string[];

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#f5f8ff]" edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-base font-semibold text-[#5f7291]">Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f5f8ff]" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      <View className="flex-1">
        <View className="min-h-[72px] flex-row items-center justify-between border-b border-[#e6edf7] bg-white px-4">
          <View className="flex-row items-center gap-2">
            <View className="h-9 w-9 items-center justify-center rounded-[12px] bg-[#2f64f6]">
              <Text className="text-base font-extrabold text-white">⌂</Text>
            </View>
            <Text className="text-[18px] font-extrabold tracking-[-0.03em] text-[#101c33]">UniBridge</Text>
          </View>

          <View className="flex-row items-center gap-2">
            <IconButton icon={faPalette as IconProp} onPress={() => setNotice('Theme settings will be available soon.')} />
            <IconButton icon={faBell as IconProp} onPress={() => setNotice('Notifications will be available soon.')} />
            <Pressable
              onPress={() => setIsAccountMenuOpen(true)}
              className="h-9 flex-row items-center gap-2 rounded-full bg-[#eaf1ff] pl-1 pr-3"
            >
              <View className="h-7 w-7 items-center justify-center rounded-full bg-white">
                <Text className="text-[11px] font-extrabold text-[#2f64f6]">{getInitials(displayName) || 'JD'}</Text>
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
                <FontAwesomeIcon icon={faCompass as IconProp} size={14} color="#d24f4f" />
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

          <Pressable onPress={() => navigation.navigate('Dashboard')} className="mb-3 self-start flex-row items-center gap-2 rounded-full border border-[#dce5f8] bg-white px-3 py-2">
            <FontAwesomeIcon icon={faArrowLeft as IconProp} size={12} color="#3a5fba" />
            <Text className="text-sm font-semibold text-[#3a5fba]">Back to dashboard</Text>
          </Pressable>

          <View className="overflow-hidden rounded-[28px] border border-[#e3ebf7] bg-white">
            <View className="h-[124px] bg-[#2f64f6]" />
            <View className="-mt-12 px-4 pb-4">
              <View className="h-[94px] w-[94px] items-center justify-center overflow-hidden rounded-full border-[4px] border-white bg-[#dce8ff] shadow-sm">
                {profilePictureSrc ? (
                  <Image
                    source={{ uri: profilePictureSrc }}
                    className="h-full w-full rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Text className="text-[24px] font-extrabold text-[#2f64f6]">{getInitials(displayName) || 'JD'}</Text>
                )}
              </View>

              <Text className="mt-4 text-[24px] font-extrabold tracking-[-0.04em] text-[#101d36]">{displayName}</Text>
              <View className="mt-2 flex-row flex-wrap items-center gap-2">
                <View className="rounded-full bg-[#eef4ff] px-3 py-1">
                  <Text className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#2f64f6]">{isAnonymous ? 'Anonymous' : roleLabel}</Text>
                </View>
                {profileMetaParts.length > 0 ? (
                  <Text className="text-sm text-[#61738f]">{profileMetaParts.join(' • ')}</Text>
                ) : null}
              </View>

              <Text className="mt-3 text-[15px] leading-6 text-[#5f7090]">{profileHeadline}</Text>

              <View className="mt-4 flex-row gap-2">
                <ProfileStat icon={faBookOpen as IconProp} label="Notes" value={String(recentNotes.length || 0)} />
                <ProfileStat icon={faComments as IconProp} label="Threads" value={String(recentThreads.length || 0)} />
              </View>
            </View>
          </View>

          <View className="mt-4 flex-row rounded-[22px] border border-[#e3ebf7] bg-white p-1">
            <TabButton active={activeTab === 'profile'} label="Profile" onPress={() => setActiveTab('profile')} />
            <TabButton active={activeTab === 'activity'} label="Activity" onPress={() => setActiveTab('activity')} />
          </View>

          {activeTab === 'profile' ? (
            <View className="mt-4 gap-3">
              {profile?.bio ? (
                <ProfileCard
                  icon={faCircleInfo as IconProp}
                  title="About"
                  actionLabel={profileBundle ? 'Edit' : undefined}
                  onAction={() => setNotice('Profile editing will be available soon.')}
                >
                  <Text className="text-[14px] leading-6 text-[#5f7090]">{profile.bio}</Text>
                </ProfileCard>
              ) : null}

              {(profile?.major || getGraduationYear(profile) || profile?.faculty) ? (
                <ProfileCard
                  icon={faGraduationCap as IconProp}
                  title="Education"
                  actionLabel={profileBundle ? 'Edit' : undefined}
                  onAction={() => setNotice('Profile editing will be available soon.')}
                >
                  <ProfileInfoRow label="Faculty" value={profile?.faculty} />
                  <ProfileInfoRow label="Major" value={profile?.major} />
                  <ProfileInfoRow label="Graduation Year" value={getGraduationYear(profile) ? String(getGraduationYear(profile)) : null} />
                </ProfileCard>
              ) : null}

              {(profile?.company || profile?.jobTitle) ? (
                <ProfileCard
                  icon={faBriefcase as IconProp}
                  title="Work Experience"
                  actionLabel={profileBundle ? 'Edit' : undefined}
                  onAction={() => setNotice('Profile editing will be available soon.')}
                >
                  <ProfileInfoRow label="Title" value={profile?.jobTitle} />
                  <ProfileInfoRow label="Company" value={profile?.company} />
                </ProfileCard>
              ) : null}

              {(profile?.interests?.length ?? 0) > 0 ? (
                <ProfileCard
                  icon={faUser as IconProp}
                  title="Interests & Skills"
                  actionLabel={profileBundle ? 'Edit' : undefined}
                  onAction={() => setNotice('Profile editing will be available soon.')}
                >
                  <View className="flex-row flex-wrap gap-2">
                    {profile?.interests?.map((interest) => (
                      <View key={interest} className="rounded-full bg-[#eef4ff] px-3 py-2">
                        <Text className="text-[12px] font-semibold text-[#2f64f6]">{interest}</Text>
                      </View>
                    ))}
                  </View>
                </ProfileCard>
              ) : null}

              <ProfileCard
                icon={faEnvelope as IconProp}
                title="Contact"
                actionLabel={profileBundle ? 'Edit' : undefined}
                onAction={() => setNotice('Profile editing will be available soon.')}
              >
                <ProfileInfoRow label="Email" value={emailAddress ?? 'Not available'} />
              </ProfileCard>

              {!profile?.bio && !profile?.major && !profile?.company && !(profile?.interests?.length ?? 0) ? (
                <View className="rounded-[26px] border border-dashed border-[#d8e2f4] bg-white px-4 py-5">
                  <Text className="text-base font-semibold text-[#13233e]">No profile information available yet.</Text>
                  <Text className="mt-1 text-sm leading-5 text-[#6a7b98]">Complete your profile to make your dashboard and profile page feel more personal.</Text>
                  <Pressable onPress={() => setNotice('Profile editing will be available soon.')} className="mt-4 self-start rounded-2xl bg-[#2f64f6] px-4 py-3">
                    <Text className="text-sm font-bold text-white">Complete Your Profile</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : (
            <View className="mt-4 gap-3">
              <ActivitySection
                title="Recent Discussions"
                loading={activityLoading}
                emptyText="No recent discussion activity yet."
                icon={faComments as IconProp}
                items={recentThreads.map((thread) => ({
                  id: thread.id,
                  label: thread.title,
                  meta: formatDate(thread.updatedAt),
                }))}
                onPressItem={() => setNotice('Discussion details will be added in the next mobile update.')}
              />

              <ActivitySection
                title="Recent Notes"
                loading={activityLoading}
                emptyText="No recent note activity yet."
                icon={faBookOpen as IconProp}
                items={recentNotes.map((note) => ({
                  id: note.id,
                  label: note.title || 'Untitled note',
                  meta: formatDate(note.updatedAt),
                }))}
                onPressItem={() => setNotice('Note details will be added in the next mobile update.')}
              />
            </View>
          )}

        </ScrollView>

        <View className="bg-white">
          <MobileBottomNav activeTab="profile" onNavigate={navigateBottom} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function ProfileCard({
  icon,
  title,
  children,
  actionLabel,
  onAction,
}: {
  icon: IconProp;
  title: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="rounded-[26px] border border-[#e3ebf7] bg-white p-4">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#f3f7ff]">
            <FontAwesomeIcon icon={icon} size={15} color="#2f64f6" />
          </View>
          <Text className="text-[18px] font-extrabold tracking-[-0.03em] text-[#101d36]">{title}</Text>
        </View>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} className="rounded-full bg-[#eef4ff] px-3 py-2">
            <Text className="text-xs font-bold text-[#2f64f6]">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function ProfileInfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return (
    <View className="mb-3 flex-row items-start justify-between gap-4 last:mb-0">
      <Text className="text-[13px] font-semibold text-[#6f829f]">{label}</Text>
      <Text className="flex-1 text-right text-[14px] font-semibold text-[#13233e]">{String(value)}</Text>
    </View>
  );
}

function ActivitySection({
  title,
  loading,
  emptyText,
  icon,
  items,
  onPressItem,
}: {
  title: string;
  loading: boolean;
  emptyText: string;
  icon: IconProp;
  items: Array<{ id: string; label: string; meta: string }>;
  onPressItem: () => void;
}) {
  return (
    <View className="rounded-[26px] border border-[#e3ebf7] bg-white p-4">
      <View className="mb-3 flex-row items-center gap-2">
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#f3f7ff]">
          <FontAwesomeIcon icon={icon} size={15} color="#2f64f6" />
        </View>
        <Text className="text-[18px] font-extrabold tracking-[-0.03em] text-[#101d36]">{title}</Text>
      </View>

      {loading ? <Text className="text-sm font-semibold text-[#6a7b98]">Loading recent activity...</Text> : null}
      {!loading && items.length === 0 ? <Text className="text-sm font-semibold text-[#7182a0]">{emptyText}</Text> : null}

      {!loading && items.length > 0 ? (
        <View className="gap-2">
          {items.map((item) => (
            <Pressable key={item.id} onPress={onPressItem} className="rounded-2xl border border-[#e7edf8] bg-[#f9fbff] px-3 py-3">
              <Text className="text-[14px] font-semibold text-[#182842]">{item.label}</Text>
              <Text className="mt-1 text-[12px] font-medium text-[#8796af]">{item.meta}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ProfileStat({ icon, label, value }: { icon: IconProp; label: string; value: string }) {
  return (
    <View className="flex-1 flex-row items-center gap-3 rounded-2xl border border-[#e6edf8] bg-[#f9fbff] px-3 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#eaf1ff]">
        <FontAwesomeIcon icon={icon} size={14} color="#2f64f6" />
      </View>
      <View>
        <Text className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f829f]">{label}</Text>
        <Text className="text-[16px] font-extrabold tracking-[-0.03em] text-[#101d36]">{value}</Text>
      </View>
    </View>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`flex-1 rounded-[18px] px-4 py-3 ${active ? 'bg-[#2f64f6]' : 'bg-transparent'}`}>
      <Text className={`text-center text-[14px] font-bold ${active ? 'text-white' : 'text-[#5f7090]'}`}>{label}</Text>
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

  return `${resolveApiBaseUrl()}${normalizedPath}`;
}

function resolveApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
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

function getGraduationYear(profile: CurrentUserProfile['profile'] | null): number | null {
  return profile?.yearOfGraduation ?? profile?.yearofGraduation ?? null;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
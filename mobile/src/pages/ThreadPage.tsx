import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
import { useTheme, useThemePicker } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Discussions'>;

export function DiscussionsPage({ navigation }: Props) {
  const { tokens } = useTheme();
  const { openThemePicker } = useThemePicker();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [activePanel, setActivePanel] = useState<ThreadPanel>('ACADEMIC');
  const [searchQuery, setSearchQuery] = useState('');
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const availablePanels = useMemo(() => {
    return profile?.role === 'ALUMNI' ? (['ALUMNI'] as const) : (['ACADEMIC', 'ALUMNI'] as const);
  }, [profile?.role]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      const token = await getValidAccessToken();
      if (cancelled) return;
      if (!token) { navigation.replace('Login'); return; }
      if (!cancelled) setAccessToken(token);
    }
    void initialize();
    return () => { cancelled = true; };
  }, [navigation]);

  useEffect(() => {
    if (!accessToken) return;
    const token = accessToken;
    let cancelled = false;
    async function loadProfile() {
      try {
        const userProfile = await loadCurrentUserProfile(token);
        if (!cancelled) {
          setProfile(userProfile);
          setActivePanel(userProfile.role === 'ALUMNI' ? 'ALUMNI' : 'ACADEMIC');
        }
      } catch {
        if (!cancelled) setProfile(null);
      }
    }
    void loadProfile();
    return () => { cancelled = true; };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    const token = accessToken;
    let cancelled = false;
    async function loadThreads() {
      try {
        setLoading(true);
        const response = await listThreads(token, { panel: activePanel, take: 50, sortBy: 'newest' });
        if (!cancelled) setThreads(response.threads);
      } catch {
        if (!cancelled) setThreads([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadThreads();
    return () => { cancelled = true; };
  }, [accessToken, activePanel]);

  async function handleLogout() {
    await clearTokens();
    navigation.replace('Login');
  }

  function navigateBottom(tab: MobileNavTab) {
    if (tab === 'home') { navigation.navigate('Dashboard'); return; }
    if (tab === 'discussions') return;
    if (tab === 'geo-board') { navigation.navigate('GeoHelpBoard'); return; }
    if (tab === 'study-groups') { navigation.navigate('StudyGroups'); return; }
    if (tab === 'notes') { navigation.navigate('Notes'); return; }
  }

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
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
    return name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  }, [profile]);

  const panelLabel =
    activePanel === 'ACADEMIC' ? 'Academic Discussions' : activePanel === 'ALUMNI' ? 'Alumni Network' : 'Career Advice';

  const panelDescription =
    activePanel === 'ACADEMIC'
      ? 'A space for students and professors to discuss coursework, research, and academic topics.'
      : activePanel === 'ALUMNI'
        ? 'Connect with alumni members and share experiences.'
        : 'Discuss career paths, job opportunities, and professional growth.';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <StatusBar style={tokens.name === 'midnight' ? 'light' : 'dark'} />

      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: tokens.primary }}>
              <FontAwesomeIcon icon={faBridge as IconProp} size={18} color="white" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: tokens.text }}>UniBridge</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconButton icon={faPalette as IconProp} onPress={openThemePicker} tokens={tokens} />
            <IconButton icon={faBell as IconProp} onPress={() => {}} tokens={tokens} />
            <Pressable
              onPress={() => setIsAccountMenuOpen(true)}
              style={{ height: 36, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, backgroundColor: tokens.primarySoft, paddingLeft: 4, paddingRight: 12 }}
            >
              <View style={{ height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: tokens.surface }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: tokens.primary }}>{profileInitials}</Text>
              </View>
              <FontAwesomeIcon icon={faChevronDown as IconProp} size={11} color={tokens.muted} />
            </Pressable>
          </View>
        </View>

        {/* Account Menu Modal */}
        <Modal visible={isAccountMenuOpen} transparent animationType="fade" onRequestClose={() => setIsAccountMenuOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 16 }} onPress={() => setIsAccountMenuOpen(false)}>
            <View style={{ marginTop: 80, alignSelf: 'flex-end', width: 192, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}>
              <Pressable
                onPress={() => { setIsAccountMenuOpen(false); navigation.navigate('Profile'); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 }}
              >
                <FontAwesomeIcon icon={faUser as IconProp} size={14} color={tokens.primary} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.text }}>Visit Profile</Text>
              </Pressable>
              <Pressable
                onPress={() => { setIsAccountMenuOpen(false); void handleLogout(); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: tokens.border, paddingHorizontal: 16, paddingVertical: 16 }}
              >
                <FontAwesomeIcon icon={faSignOutAlt as IconProp} size={14} color={tokens.danger} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.danger }}>Log out</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Main Content */}
        <ScrollView contentContainerStyle={{ paddingBottom: 112 }} showsVerticalScrollIndicator={false}>
          {/* Title Section */}
          <View style={{ borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 16, paddingVertical: 20 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: tokens.text }}>Discussions</Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: tokens.muted }}>
              Join conversations with your academic community
            </Text>
          </View>

          {/* New Discussion Button */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Pressable onPress={() => setShowCreateModal(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 24, backgroundColor: tokens.primary, paddingHorizontal: 16, paddingVertical: 14 }}>
              <FontAwesomeIcon icon={faPlus as IconProp} size={18} color="white" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>New Discussion</Text>
            </Pressable>
          </View>

          {/* Panel Tabs */}
          {availablePanels.length > 1 && (
            <View style={{ marginTop: 16, flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
              {availablePanels.map((panel) => {
                const isActive = panel === activePanel;
                const tabLabel = panel === 'ACADEMIC' ? 'Academic Discussions' : 'Career Advice';
                const tabIcon = panel === 'ACADEMIC' ? faComments : faPalette;
                return (
                  <Pressable
                    key={panel}
                    onPress={() => { setActivePanel(panel); setSearchQuery(''); }}
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                      borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: isActive ? tokens.primary : tokens.border,
                      backgroundColor: isActive ? tokens.primarySoft : tokens.surface,
                    }}
                  >
                    <FontAwesomeIcon icon={tabIcon as IconProp} size={13} color={isActive ? tokens.primary : tokens.muted} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: isActive ? tokens.primary : tokens.muted }} numberOfLines={1}>
                      {tabLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Panel Description */}
          <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, backgroundColor: tokens.primarySoft, padding: 14 }}>
              <View style={{ height: 40, width: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: tokens.surface }}>
                <FontAwesomeIcon icon={faComments as IconProp} size={16} color={tokens.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.text }}>{panelLabel}</Text>
                <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 16, color: tokens.muted }}>{panelDescription}</Text>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingLeft: 12, paddingRight: 10 }}>
              <FontAwesomeIcon icon={faSearch as IconProp} size={14} color={tokens.muted} />
              <TextInput
                placeholder="Search discussions..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={{ marginLeft: 10, flex: 1, paddingVertical: 10, fontSize: 14, color: tokens.text }}
                placeholderTextColor={tokens.muted}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                  <FontAwesomeIcon icon={faX as IconProp} size={12} color={tokens.muted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Threads List */}
          <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
            {loading ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.muted }}>Loading discussions...</Text>
              </View>
            ) : filteredThreads.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 16, paddingVertical: 32 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.muted }}>
                  {searchQuery.trim() ? 'No discussions match your search' : 'No discussions yet. Start one!'}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {filteredThreads.map((thread) => (
                  <DiscussionThreadItem
                    key={thread.id}
                    thread={thread}
                    tokens={tokens}
                    onPress={() => navigation.navigate('ThreadDetail', { threadId: thread.id })}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={{ backgroundColor: tokens.surface }}>
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
          const response = await listThreads(accessToken, { panel: activePanel, take: 50, sortBy: 'newest' });
          setThreads(response.threads);
        }}
      />
    </SafeAreaView>
  );
}

function DiscussionThreadItem({ thread, tokens, onPress }: { thread: ThreadSummary; tokens: any; onPress: () => void }) {
  const authorInitial = (thread.authorName || 'U').charAt(0).toUpperCase();

  return (
    <Pressable onPress={onPress} style={{ overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 }}>
        <View style={{ height: 40, width: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: tokens.primarySoft }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.primary }}>{authorInitial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.text }}>{thread.authorName || 'UniBridge User'}</Text>
            <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: thread.panel === 'ALUMNI' ? tokens.accentSoft : tokens.primarySoft }}>
              <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: thread.panel === 'ALUMNI' ? tokens.accent : tokens.primary }}>
                {thread.panel === 'ALUMNI' ? 'alumni' : 'academic'}
              </Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '500', color: tokens.muted }}>{formatRelativeDate(thread.updatedAt)}</Text>
          </View>

          <Text style={{ marginTop: 8, fontSize: 15, fontWeight: '600', lineHeight: 20, color: tokens.text }} numberOfLines={2}>
            {thread.title}
          </Text>

          {thread.description && (
            <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: tokens.muted }} numberOfLines={2}>
              {thread.description}
            </Text>
          )}

          <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '500', color: tokens.muted }}>
              {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function IconButton({ icon, onPress, tokens }: { icon: IconProp; onPress: () => void; tokens: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}
    >
      <FontAwesomeIcon icon={icon} size={14} color={tokens.muted} />
    </Pressable>
  );
}

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

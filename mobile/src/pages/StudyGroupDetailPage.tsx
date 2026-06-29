import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowLeft,
  faCircleInfo,
  faEllipsisVertical,
  faGlobe,
  faLock,
  faPaperPlane,
  faPaperclip,
  faUsers,
  faX,
} from '@fortawesome/free-solid-svg-icons';
import {
  createStudyGroupPost,
  getStudyGroup,
  joinStudyGroup,
  leaveStudyGroup,
  listStudyGroupMembers,
  listStudyGroupPosts,
  type StudyGroup,
  type StudyGroupMember,
  type StudyGroupPost,
} from '../api/study-groups.api';
import { getValidAccessToken } from '../lib/auth-session';
import type { RootStackParamList } from '../navigation/root-stack';
import { useTheme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'StudyGroupDetail'>;
type TimelineItem =
  | { type: 'date'; key: string; label: string }
  | { type: 'message'; key: string; post: StudyGroupPost };

const VISIBILITY_COLORS: Record<'PUBLIC' | 'PRIVATE', string> = {
  PUBLIC: '#10b981',
  PRIVATE: '#f59e0b',
};

function decodeUserId(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      userId?: string;
    };
    return payload.userId ?? null;
  } catch {
    return null;
  }
}

function formatDateLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const sameYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (sameDay) return 'Today';
  if (sameYesterday) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDisplayName(userId: string, currentUserId: string | null): string {
  if (userId === currentUserId) return 'You';

  const cleaned = userId.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return 'Member';

  return cleaned
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getInitials(userId: string): string {
  const cleaned = userId.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  const parts = cleaned ? cleaned.split(' ') : [userId];

  return parts
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getBubbleAccent(authorId: string, currentUserId: string | null, isMidnight: boolean): string {
  if (authorId === currentUserId) {
    return isMidnight ? '#0d2d1a' : '#d7f6e7';
  }
  if (isMidnight) {
    return '#1c2230';
  }
  const palette = ['#ffffff', '#f8fbff', '#f6f8fc', '#fffdf7'];
  const index = Math.abs(authorId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % palette.length;
  return palette[index];
}

function getPostTimestamp(post: StudyGroupPost): string {
  const createdAt = post.createdAt ? new Date(post.createdAt) : null;
  if (createdAt && !Number.isNaN(createdAt.getTime())) {
    return post.createdAt;
  }

  const updatedAt = post.updatedAt ? new Date(post.updatedAt) : null;
  if (updatedAt && !Number.isNaN(updatedAt.getTime())) {
    return post.updatedAt;
  }

  return '';
}

export function StudyGroupDetailPage({ route, navigation }: Props) {
  const { tokens } = useTheme();
  const groupId = route.params?.groupId ?? '';
  const resolvedGroupId = groupId as string;
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [members, setMembers] = useState<StudyGroupMember[]>([]);
  const [posts, setPosts] = useState<StudyGroupPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [postDraft, setPostDraft] = useState('');
  const [postingMessage, setPostingMessage] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const token = await getValidAccessToken();
        if (cancelled) return;

        setAccessToken(token);
        setCurrentUserId(token ? decodeUserId(token) : null);
      } catch {
        if (!cancelled) {
          setError('Authentication failed. Please sign in again.');
        }
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken || !resolvedGroupId) return;
      const activeToken = accessToken as string;

      let cancelled = false;

      async function fetchData() {
        try {
          setLoading(true);
          setError(null);

          const [groupData, membersData, postsData] = await Promise.all([
            getStudyGroup(activeToken, resolvedGroupId),
            listStudyGroupMembers(activeToken, resolvedGroupId),
            listStudyGroupPosts(activeToken, resolvedGroupId),
          ]);

          if (cancelled) return;

          setGroup(groupData);
          setMembers(membersData);
          setPosts(
            postsData
              .slice()
              .sort((a, b) => {
                const aTime = new Date(getPostTimestamp(a)).getTime();
                const bTime = new Date(getPostTimestamp(b)).getTime();
                return (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
              }),
          );
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Failed to load group details.');
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
    }, [accessToken, resolvedGroupId]),
  );

  const currentUserMember = useMemo(
    () => members.find((member) => member.userId === currentUserId),
    [members, currentUserId],
  );

  const isMember = currentUserMember?.joinStatus === 'ACTIVE';
  const isOwner = currentUserMember?.role === 'OWNER';
  const activeMembers = members.filter((member) => member.joinStatus === 'ACTIVE');

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    let previousDayKey = '';

    for (const post of posts) {
      const timestamp = getPostTimestamp(post);
      const dayKey = timestamp ? new Date(timestamp).toDateString() : 'invalid';
      if (dayKey !== previousDayKey) {
        items.push({ type: 'date', key: `date-${dayKey}-${post.id}`, label: timestamp ? formatDateLabel(timestamp) : 'Date unavailable' });
        previousDayKey = dayKey;
      }

      items.push({ type: 'message', key: post.id, post });
    }

    return items;
  }, [posts]);

  const pinnedNotice = useMemo(() => {
    if (!group) return '';
    const memberCount = activeMembers.length;
    return `${memberCount} active member${memberCount === 1 ? '' : 's'} in this group chat.`;
  }, [group, activeMembers.length]);

  const handlePostMessage = useCallback(async () => {
    if (!accessToken || !resolvedGroupId || !postDraft.trim()) return;

    try {
      setPostingMessage(true);
      setActionError(null);

      const newPost = await createStudyGroupPost(accessToken, resolvedGroupId, postDraft.trim());
      setPosts((currentPosts) => [...currentPosts, newPost]);
      setPostDraft('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to post message.');
    } finally {
      setPostingMessage(false);
    }
  }, [accessToken, resolvedGroupId, postDraft]);

  const handleJoinLeave = useCallback(
    async (action: 'join' | 'leave') => {
      if (!accessToken || !resolvedGroupId) return;

      try {
        setIsJoining(true);
        setActionError(null);

        if (action === 'join') {
          await joinStudyGroup(accessToken, resolvedGroupId);
        } else {
          await leaveStudyGroup(accessToken, resolvedGroupId);
        }

        const [membersData, postsData] = await Promise.all([
          listStudyGroupMembers(accessToken, resolvedGroupId),
          listStudyGroupPosts(accessToken, resolvedGroupId),
        ]);

        setMembers(membersData);
        setPosts(
          postsData
            .slice()
            .sort((a, b) => {
              const aTime = new Date(getPostTimestamp(a)).getTime();
              const bTime = new Date(getPostTimestamp(b)).getTime();
              return (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
            }),
        );
      } catch (err) {
        setActionError(err instanceof Error ? err.message : `Failed to ${action} group.`);
      } finally {
        setIsJoining(false);
      }
    },
    [accessToken, resolvedGroupId],
  );

  if (loading || !accessToken) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={tokens.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.surface, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => navigation.goBack()} style={{ height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: tokens.primarySoft }}>
            <FontAwesomeIcon icon={faArrowLeft as IconProp} size={18} color={tokens.primary} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ textAlign: 'center', color: tokens.danger }}>{error || 'Group not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const titleInitials = getInitials(group.name);
  const isMidnight = tokens.name === 'midnight';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style={isMidnight ? 'light' : 'dark'} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={{ borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 16, paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable onPress={() => navigation.goBack()} style={{ height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: tokens.primarySoft }}>
                <FontAwesomeIcon icon={faArrowLeft as IconProp} size={16} color={tokens.primary} />
              </Pressable>

              <View style={{ height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: tokens.primary }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: 'white', marginTop: 10 }}>{titleInitials || 'SG'}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: tokens.text }} numberOfLines={1}>
                    {group.name}
                  </Text>
                  <View style={{ borderRadius: 999, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <FontAwesomeIcon
                        icon={(group.visibility === 'PUBLIC' ? faGlobe : faLock) as IconProp}
                        size={8}
                        color={VISIBILITY_COLORS[group.visibility]}
                      />
                      <Text style={{ color: VISIBILITY_COLORS[group.visibility], fontSize: 9, fontWeight: '700' }}>
                        {group.visibility}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: tokens.muted }} numberOfLines={1}>
                  {activeMembers.length} members
                </Text>
              </View>

              <Pressable onPress={() => setShowMembersModal(true)} style={{ height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: tokens.surfaceElevated }}>
                <FontAwesomeIcon icon={faUsers as IconProp} size={15} color={tokens.primary} />
              </Pressable>
            </View>

            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isMember ? (
                <Pressable
                  onPress={() => handleJoinLeave('leave')}
                  disabled={isJoining || isOwner}
                  style={{ borderRadius: 20, backgroundColor: isOwner ? tokens.surfaceElevated : (isMidnight ? '#3a1a1e' : '#ffe8e8'), paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isOwner ? tokens.muted : tokens.danger }}>
                    {isOwner ? 'Owner' : 'Leave group'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => handleJoinLeave('join')}
                  disabled={isJoining}
                  style={{ borderRadius: 20, backgroundColor: tokens.primary, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  {isJoining ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: 'white' }}>Join group</Text>
                  )}
                </Pressable>
              )}

              <View style={{ flex: 1, borderRadius: 20, backgroundColor: tokens.primarySoft, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ fontSize: 11, color: tokens.primaryStrong, fontWeight: '600' }} numberOfLines={1}>
                  {pinnedNotice}
                </Text>
              </View>
            </View>
          </View>

          {actionError && (
            <View style={{ marginHorizontal: 16, marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: tokens.danger, backgroundColor: isMidnight ? '#3a1a1e' : '#ffe8e8', paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ fontSize: 13, color: tokens.danger }}>{actionError}</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <FlatList
              data={timelineItems}
              keyExtractor={(item) => item.key}
              contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              ListEmptyComponent={() => (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ maxWidth: 280, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 16, paddingVertical: 20, alignItems: 'center' }}>
                    <View style={{ marginBottom: 12, height: 44, width: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: tokens.primarySoft }}>
                      <FontAwesomeIcon icon={faCircleInfo as IconProp} size={16} color={tokens.primary} style={{ marginTop: 14 }} />
                    </View>
                    <Text style={{ textAlign: 'center', fontSize: 15, fontWeight: '700', color: tokens.text }}>
                      The chat is ready.
                    </Text>
                    <Text style={{ marginTop: 6, textAlign: 'center', fontSize: 12, lineHeight: 18, color: tokens.muted }}>
                      Start the conversation by posting the first message, or join the group if you have not yet.
                    </Text>
                  </View>
                </View>
              )}
              renderItem={({ item }) => {
                if (item.type === 'date') {
                  return (
                    <View style={{ alignItems: 'center', marginVertical: 12 }}>
                      <View style={{ borderRadius: 20, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, color: tokens.muted }}>
                          {item.label}
                        </Text>
                      </View>
                    </View>
                  );
                }

                const post = item.post;
                const authorId = post.authorId;
                const isCurrentUser = authorId === currentUserId;
                const author = getDisplayName(authorId, currentUserId);
                const timestamp = getPostTimestamp(post);
                const bubbleColor = getBubbleAccent(authorId, currentUserId, isMidnight);

                return (
                  <View style={{ marginBottom: 12, flexDirection: 'row', justifyContent: isCurrentUser ? 'flex-end' : 'flex-start' }}>
                    {!isCurrentUser && (
                      <View style={{ marginRight: 8, marginTop: 4, height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: tokens.primarySoft }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: tokens.primary, marginTop: 6 }}>{getInitials(authorId) || 'M'}</Text>
                      </View>
                    )}

                    <View style={{ maxWidth: '80%', alignItems: isCurrentUser ? 'flex-end' : 'flex-start' }}>
                      {!isCurrentUser && (
                        <Text style={{ marginBottom: 2, marginLeft: 4, fontSize: 10, fontWeight: '600', color: tokens.muted }}>{author}</Text>
                      )}

                      <View
                        style={{
                          borderRadius: 16,
                          borderTopLeftRadius: 16,
                          borderTopRightRadius: 16,
                          borderBottomRightRadius: isCurrentUser ? 4 : 16,
                          borderBottomLeftRadius: isCurrentUser ? 16 : 4,
                          borderWidth: isCurrentUser ? 0 : 1,
                          borderColor: tokens.border,
                          backgroundColor: bubbleColor,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                        }}
                      >
                        <Text style={{ fontSize: 14, lineHeight: 20, color: isCurrentUser ? (isMidnight ? '#d7f6e7' : '#113325') : tokens.text }}>
                          {post.content}
                        </Text>

                        <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          {post.status !== 'ACTIVE' && (
                            <Text style={{ fontSize: 9, fontWeight: '700', color: tokens.muted }}>{post.status}</Text>
                          )}
                          <Text style={{ fontSize: 9, color: isCurrentUser ? (isMidnight ? '#4a7d60' : '#4a7d60') : tokens.muted }}>
                            {timestamp ? formatTime(timestamp) : ''}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          </View>

          {/* Composer */}
          <View style={{ borderTopWidth: 1, borderTopColor: tokens.border, backgroundColor: tokens.surface, paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: 12, paddingTop: 12 }}>
            {isMember ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 24, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 8, paddingVertical: 6 }}>
                <Pressable style={{ height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: tokens.surface }}>
                  <FontAwesomeIcon icon={faPaperclip as IconProp} size={15} color={tokens.primary} style={{ marginTop: 10 }} />
                </Pressable>

                <TextInput
                  placeholder="Type a message"
                  value={postDraft}
                  onChangeText={setPostDraft}
                  editable={!postingMessage}
                  multiline
                  placeholderTextColor={tokens.muted}
                  style={{ minHeight: 36, flex: 1, fontSize: 14, color: tokens.text, maxHeight: 100, textAlignVertical: 'top' }}
                />

                <Pressable
                  onPress={handlePostMessage}
                  disabled={!postDraft.trim() || postingMessage}
                  style={{
                    height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18,
                    backgroundColor: postDraft.trim() && !postingMessage ? tokens.primary : tokens.primarySoft
                  }}
                >
                  {postingMessage ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <FontAwesomeIcon icon={faPaperPlane as IconProp} size={14} color="white" style={{ marginTop: 10 }} />
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 }}>
                <Text style={{ textAlign: 'center', fontSize: 13, color: tokens.muted }}>
                  Join the group to post and chat with members.
                </Text>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Members Modal */}
      <Modal visible={showMembersModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMembersModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: tokens.surface }}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: tokens.border, paddingHorizontal: 16, paddingVertical: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.text }}>Members ({activeMembers.length})</Text>
              <Pressable onPress={() => setShowMembersModal(false)} style={{ padding: 4 }}>
                <FontAwesomeIcon icon={faX as IconProp} size={20} color={tokens.muted} />
              </Pressable>
            </View>
          </View>

          <FlatList
            data={activeMembers}
            keyExtractor={(item) => item.userId}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item: member }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: tokens.primarySoft }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: tokens.primary, marginTop: 8 }}>{getInitials(member.userId) || 'M'}</Text>
                  </View>
                  <View>
                    <Text style={{ fontWeight: '700', color: tokens.text, fontSize: 14 }}>{getDisplayName(member.userId, currentUserId)}</Text>
                    <Text style={{ fontSize: 11, color: tokens.muted, marginTop: 2 }}>{member.role}</Text>
                  </View>
                </View>
                {member.role === 'OWNER' ? (
                  <View style={{ backgroundColor: tokens.accentSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: tokens.accent }}>Owner</Text>
                  </View>
                ) : member.role === 'MODERATOR' ? (
                  <View style={{ backgroundColor: tokens.primarySoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: tokens.primary }}>Moderator</Text>
                  </View>
                ) : null}
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

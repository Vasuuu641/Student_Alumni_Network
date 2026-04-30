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

function getBubbleAccent(authorId: string, currentUserId: string | null): string {
  if (authorId === currentUserId) return '#d7f6e7';

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
    return `${memberCount} active member${memberCount === 1 ? '' : 's'} in this group chat. Tap the member chip to view everyone.`;
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
      <SafeAreaView className="flex-1 bg-[#edf3ee]">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2f64f6" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !group) {
    return (
      <SafeAreaView className="flex-1 bg-[#edf3ee]">
        <View className="border-b border-[#dbe5d9] bg-white px-4 py-4">
          <Pressable onPress={() => navigation.goBack()} className="h-10 w-10 items-center justify-center rounded-full bg-[#eff4fb]">
            <FontAwesomeIcon icon={faArrowLeft as IconProp} size={18} color="#24334d" />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center text-red-600">{error || 'Group not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const titleInitials = getInitials(group.name);

  return (
    <SafeAreaView className="flex-1 bg-[#edf3ee]" edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <View className="absolute left-[-40px] top-20 h-32 w-32 rounded-full bg-white/40" />
      <View className="absolute right-[-50px] top-36 h-40 w-40 rounded-full bg-[#cfe8d7]/40" />
      <View className="absolute bottom-32 left-10 h-24 w-24 rounded-full bg-white/25" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 100}
      >
      <View className="flex-1">
        <View className="border-b border-[#dce6dd] bg-white px-4 py-3 shadow-sm">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => navigation.goBack()} className="h-10 w-10 items-center justify-center rounded-full bg-[#f0f4fb]">
              <FontAwesomeIcon icon={faArrowLeft as IconProp} size={18} color="#24334d" />
            </Pressable>

            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#2f64f6]">
              <Text className="text-xs font-extrabold text-white">{titleInitials || 'SG'}</Text>
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 text-[16px] font-bold text-[#101c33]" numberOfLines={1}>
                  {group.name}
                </Text>
                <View className="rounded-full border border-[#cfe8d9] bg-[#ecfbf2] px-2 py-0.5">
                  <View className="flex-row items-center gap-1">
                    <FontAwesomeIcon
                      icon={(group.visibility === 'PUBLIC' ? faGlobe : faLock) as IconProp}
                      size={10}
                      color={VISIBILITY_COLORS[group.visibility]}
                    />
                    <Text style={{ color: VISIBILITY_COLORS[group.visibility] }} className="text-[10px] font-bold">
                      {group.visibility}
                    </Text>
                  </View>
                </View>
              </View>
              <Text className="text-[12px] text-[#7686a0]" numberOfLines={1}>
                {activeMembers.length} members
              </Text>
            </View>

            <Pressable onPress={() => setShowMembersModal(true)} className="h-10 w-10 items-center justify-center rounded-full bg-[#f3f6fb]">
              <FontAwesomeIcon icon={faUsers as IconProp} size={17} color="#50607a" />
            </Pressable>

            <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-[#f3f6fb]">
              <FontAwesomeIcon icon={faEllipsisVertical as IconProp} size={17} color="#50607a" />
            </Pressable>
          </View>

          <View className="mt-3 flex-row items-center gap-2">
            <Pressable onPress={() => setShowMembersModal(true)} className="rounded-full bg-[#eef4ff] px-3 py-1.5">
              <Text className="text-[12px] font-semibold text-[#2f64f6]">{activeMembers.length} members</Text>
            </Pressable>

            <View className="flex-1 rounded-full bg-[#fff4db] px-3 py-1.5">
              <Text className="text-[12px] text-[#9b6f14]" numberOfLines={1}>
                {pinnedNotice}
              </Text>
            </View>
          </View>

          <View className="mt-3 flex-row items-center gap-2">
            {isMember ? (
              <Pressable
                onPress={() => handleJoinLeave('leave')}
                disabled={isJoining || isOwner}
                className={`rounded-full px-4 py-2 ${isOwner ? 'bg-[#e7edf6]' : 'bg-[#ffe8e8]'}`}
              >
                <Text className={`text-[12px] font-semibold ${isOwner ? 'text-[#6b7c92]' : 'text-[#d14b4b]'}`}>
                  {isOwner ? 'Owner' : 'Leave group'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => handleJoinLeave('join')}
                disabled={isJoining}
                className="rounded-full bg-[#2f64f6] px-4 py-2"
              >
                {isJoining ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-[12px] font-semibold text-white">Join group</Text>
                )}
              </Pressable>
            )}

            <View className="rounded-full bg-[#eef4ff] px-3 py-2">
              <Text className="text-[12px] font-medium text-[#4f6486]">
                Created {formatDateLabel(group.createdAt)}
              </Text>
            </View>
          </View>
        </View>

        {actionError && (
          <View className="mx-4 mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
            <Text className="text-sm text-red-700">{actionError}</Text>
          </View>
        )}

        <View className="flex-1">
          <FlatList
            data={timelineItems}
            keyExtractor={(item) => item.key}
            contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={() => (
              <View className="flex-1 items-center justify-center px-4 py-12">
                <View className="max-w-[300px] rounded-[28px] border border-dashed border-[#cfd9c9] bg-white/80 px-5 py-6 shadow-sm">
                  <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-[#e9f2ff]">
                    <FontAwesomeIcon icon={faCircleInfo as IconProp} size={18} color="#2f64f6" />
                  </View>
                  <Text className="text-center text-[16px] font-semibold text-[#101c33]">
                    The chat is ready.
                  </Text>
                  <Text className="mt-2 text-center text-[13px] leading-5 text-[#71829b]">
                    Start the conversation by posting the first message, or join the group if you have not yet.
                  </Text>
                </View>
              </View>
            )}
            renderItem={({ item }) => {
              if (item.type === 'date') {
                return (
                  <View className="my-4 items-center">
                    <View className="rounded-full bg-white px-4 py-1.5 shadow-sm">
                      <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#97a5ba]">
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

              return (
                <View className={`mb-3 flex-row ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                  {!isCurrentUser && (
                    <View className="mr-2 mt-1 h-9 w-9 items-center justify-center rounded-full bg-[#7c4dff]">
                      <Text className="text-[11px] font-bold text-white">{getInitials(authorId) || 'M'}</Text>
                    </View>
                  )}

                  <View className={`max-w-[82%] ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                    {!isCurrentUser && (
                      <Text className="mb-1 ml-1 text-[11px] font-semibold text-[#72829a]">{author}</Text>
                    )}

                    <View
                      className={`rounded-[22px] px-4 py-3 shadow-sm ${isCurrentUser ? 'rounded-br-md bg-[#d7f6e7]' : 'rounded-bl-md border border-[#e5ebf3]'}`}
                      style={{ backgroundColor: isCurrentUser ? '#d7f6e7' : getBubbleAccent(authorId, currentUserId) }}
                    >
                      <Text className={`text-[15px] leading-6 ${isCurrentUser ? 'text-[#113325]' : 'text-[#1f2e44]'}`}>
                        {post.content}
                      </Text>

                      <View className="mt-1 flex-row items-center justify-end gap-2">
                        {post.status !== 'ACTIVE' && (
                          <Text className="text-[10px] font-semibold text-[#8a97ab]">{post.status}</Text>
                        )}
                            <Text className={`text-[10px] ${isCurrentUser ? 'text-[#4a7d60]' : 'text-[#8b99ad]'}`}>
                          {timestamp ? formatTime(timestamp) : ''}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {isCurrentUser && <View className="ml-2 mt-1 h-9 w-9" />}
                </View>
              );
            }}
          />
        </View>

        <View className="border-t border-[#d9e3dc] bg-white px-3 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 10) }}>
          {isMember ? (
            <View className="mb-2 flex-row items-end gap-2 rounded-[28px] border border-[#d9e3ec] bg-[#f8fbff] px-3 py-2 shadow-sm">
              <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-[#eef4ff]">
                <FontAwesomeIcon icon={faPaperclip as IconProp} size={16} color="#4f6486" />
              </Pressable>

              <TextInput
                placeholder="Type a message"
                value={postDraft}
                onChangeText={setPostDraft}
                editable={!postingMessage}
                multiline
                placeholderTextColor="#8ea0b8"
                className="min-h-10 flex-1 rounded-2xl bg-white px-4 py-3 text-[15px] text-[#101c33]"
                style={{ maxHeight: 120 }}
                textAlignVertical="top"
              />

              <Pressable
                onPress={handlePostMessage}
                disabled={!postDraft.trim() || postingMessage}
                className={`h-11 w-11 items-center justify-center rounded-full ${postDraft.trim() && !postingMessage ? 'bg-[#2f64f6]' : 'bg-[#c8d4ea]'}`}
              >
                {postingMessage ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <FontAwesomeIcon icon={faPaperPlane as IconProp} size={16} color="white" />
                )}
              </Pressable>
            </View>
          ) : (
            <View className="mb-2 rounded-[24px] border border-[#dbe5d9] bg-[#f9fcf8] px-4 py-3">
              <Text className="text-center text-[13px] text-[#617185]">
                Join the group to post and chat with members.
              </Text>
            </View>
          )}
        </View>
      </View>
      </KeyboardAvoidingView>

      <Modal visible={showMembersModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="border-b border-gray-200 px-4 py-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-bold text-gray-900">Members ({activeMembers.length})</Text>
              <Pressable onPress={() => setShowMembersModal(false)} className="p-2">
                <FontAwesomeIcon icon={faX as IconProp} size={24} color="#6b7280" />
              </Pressable>
            </View>
          </View>

          <FlatList
            data={activeMembers}
            keyExtractor={(item) => item.userId}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item: member }) => (
              <View className="flex-row items-center justify-between rounded-2xl border border-[#e6edf5] bg-[#fafcff] p-4">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-[#e4eeff]">
                    <Text className="text-[11px] font-bold text-[#2f64f6]">{getInitials(member.userId) || 'M'}</Text>
                  </View>
                  <View>
                    <Text className="font-semibold text-gray-900">{getDisplayName(member.userId, currentUserId)}</Text>
                    <Text className="text-xs text-gray-500">{member.role}</Text>
                  </View>
                </View>
                {member.role === 'OWNER' ? (
                  <View className="rounded-full bg-amber-100 px-2 py-1">
                    <Text className="text-xs font-medium text-amber-700">Owner</Text>
                  </View>
                ) : member.role === 'MODERATOR' ? (
                  <View className="rounded-full bg-blue-100 px-2 py-1">
                    <Text className="text-xs font-medium text-blue-700">Moderator</Text>
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

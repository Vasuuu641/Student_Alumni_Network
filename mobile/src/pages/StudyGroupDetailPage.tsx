import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { faArrowLeft, faGlobe, faLock, faPlus, faX } from '@fortawesome/free-solid-svg-icons';
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

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
            postsData.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
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

  const activeMembers = members.filter((member) => member.joinStatus === 'ACTIVE');
  const isMember = currentUserMember?.joinStatus === 'ACTIVE';
  const isOwner = currentUserMember?.role === 'OWNER';

  const handlePostMessage = useCallback(async () => {
    if (!accessToken || !resolvedGroupId || !postDraft.trim()) return;

    try {
      setPostingMessage(true);
      setActionError(null);

      const newPost = await createStudyGroupPost(accessToken, resolvedGroupId, postDraft.trim());
      setPosts((currentPosts) => [newPost, ...currentPosts]);
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
        setPosts(postsData.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
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
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2f64f6" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !group) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="border-b border-gray-200 px-4 py-4">
          <Pressable onPress={() => navigation.goBack()}>
            <FontAwesomeIcon icon={faArrowLeft as IconProp} size={24} color="#1f2937" />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center text-red-600">{error || 'Group not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />

      <View className="border-b border-gray-200 px-4 py-4">
        <Pressable onPress={() => navigation.goBack()} className="mb-4 w-full flex-row items-center">
          <FontAwesomeIcon icon={faArrowLeft as IconProp} size={24} color="#1f2937" />
        </Pressable>

        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-2xl font-bold text-gray-900">{group.name}</Text>
            <View style={{ backgroundColor: VISIBILITY_COLORS[group.visibility] + '20' }} className="rounded px-2 py-1">
              <View className="flex-row items-center gap-1">
                <FontAwesomeIcon
                  icon={(group.visibility === 'PUBLIC' ? faGlobe : faLock) as IconProp}
                  size={12}
                  color={VISIBILITY_COLORS[group.visibility]}
                />
                <Text style={{ color: VISIBILITY_COLORS[group.visibility] }} className="text-xs font-medium">
                  {group.visibility}
                </Text>
              </View>
            </View>
          </View>

          <Text className="text-sm text-gray-600">{group.description}</Text>

          <View className="mt-3 flex-row items-center gap-4">
            <Pressable onPress={() => setShowMembersModal(true)} className="flex-row items-center gap-1">
              <Text className="text-xs font-medium text-blue-600">{activeMembers.length} members</Text>
            </Pressable>
            <Text className="text-xs text-gray-500">Created {formatDate(group.createdAt)}</Text>
          </View>

          {!isMember && (
            <Pressable
              onPress={() => handleJoinLeave('join')}
              disabled={isJoining}
              className="mt-3 flex-row items-center justify-center rounded-lg bg-blue-500 py-2"
            >
              {isJoining ? <ActivityIndicator size="small" color="white" /> : <Text className="font-semibold text-white">Join Group</Text>}
            </Pressable>
          )}
        </View>
      </View>

      {actionError && (
        <View className="mx-4 my-4 rounded-lg bg-red-50 p-3">
          <Text className="text-sm text-red-700">{actionError}</Text>
        </View>
      )}

      {isMember && (
        <View className="border-b border-gray-200 px-4 py-4">
          <Text className="mb-3 font-semibold text-gray-900">Leave a message</Text>
          <View className="flex-row gap-2">
            <TextInput
              placeholder="Write something..."
              value={postDraft}
              onChangeText={setPostDraft}
              multiline
              numberOfLines={2}
              editable={!postingMessage}
              className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900"
              placeholderTextColor="#9ca3af"
            />
            <Pressable
              onPress={handlePostMessage}
              disabled={!postDraft.trim() || postingMessage}
              className={`items-center justify-center rounded-lg px-3 py-2 ${postDraft.trim() && !postingMessage ? 'bg-blue-500' : 'bg-gray-300'}`}
            >
              {postingMessage ? <ActivityIndicator size="small" color="white" /> : <FontAwesomeIcon icon={faPlus as IconProp} size={20} color="white" />}
            </Pressable>
          </View>
        </View>
      )}

      {posts.length === 0 ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}
          className="flex-1"
        >
          <Text className="text-center text-gray-500">
            {isMember ? 'No messages yet. Be the first to share!' : 'Join the group to see and post messages.'}
          </Text>
        </ScrollView>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item: post }) => {
            const author = members.find((member) => member.userId === post.authorId);
            return (
              <View className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900">{author?.userId === currentUserId ? 'You' : author?.userId || 'Member'}</Text>
                    <Text className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleDateString()}</Text>
                  </View>
                  {post.status !== 'ACTIVE' && <Text className="text-xs text-gray-500">{post.status}</Text>}
                </View>

                <Text className="mt-2 text-gray-700">{post.content}</Text>
              </View>
            );
          }}
        />
      )}

      <Modal visible={showMembersModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-1">
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
                <View className="flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                  <View className="flex-1">
                    <Text className="font-medium text-gray-900">{member.userId === currentUserId ? 'You' : member.userId}</Text>
                    <Text className="text-xs text-gray-500">{member.role}</Text>
                  </View>
                  {member.role === 'OWNER' && (
                    <View className="rounded-full bg-amber-100 px-2 py-1">
                      <Text className="text-xs font-medium text-amber-700">Owner</Text>
                    </View>
                  )}
                  {member.role === 'MODERATOR' && (
                    <View className="rounded-full bg-blue-100 px-2 py-1">
                      <Text className="text-xs font-medium text-blue-700">Moderator</Text>
                    </View>
                  )}
                </View>
              )}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {isMember && (
        <View className="border-t border-gray-200 px-4 py-4">
          <Pressable
            onPress={() => handleJoinLeave('leave')}
            disabled={isJoining || isOwner}
            className={`flex-row items-center justify-center rounded-lg py-3 ${isOwner ? 'bg-gray-300' : 'bg-red-500'}`}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="font-semibold text-white">{isOwner ? 'You are the owner' : 'Leave Group'}</Text>
            )}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

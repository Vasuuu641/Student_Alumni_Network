import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowLeft,
  faChevronDown,
  faThumbsDown,
  faThumbsUp,
  faX,
} from '@fortawesome/free-solid-svg-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  getThread,
  listReplies,
  postReply,
  voteThread,
  voteReply,
  editReply,
  deleteReply,
  createThreadsSocket,
  type Thread,
  type ThreadReply,
  type VoteType,
} from '../api/threads.api';
import { getValidAccessToken } from '../lib/auth-session';
import type { RootStackParamList } from '../navigation/root-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'ThreadDetail'>;

function decodeUserId(token: string): string | null {
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    ) as { userId?: string };
    return payload.userId ?? null;
  } catch {
    return null;
  }
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

function getVoteTransition(
  previousVote: VoteType | null | undefined,
  clickedVote: VoteType,
): {
  nextVote: VoteType | null;
  scoreDelta: number;
  upvoteDelta: number;
  downvoteDelta: number;
} {
  const prev = previousVote ?? null;
  const nextVote = prev === clickedVote ? null : clickedVote;

  const scoreByVote = (vote: VoteType | null): number => {
    if (vote === 'UPVOTE') return 1;
    if (vote === 'DOWNVOTE') return -1;
    return 0;
  };

  const scoreDelta = scoreByVote(nextVote) - scoreByVote(prev);
  const upvoteDelta = (nextVote === 'UPVOTE' ? 1 : 0) - (prev === 'UPVOTE' ? 1 : 0);
  const downvoteDelta = (nextVote === 'DOWNVOTE' ? 1 : 0) - (prev === 'DOWNVOTE' ? 1 : 0);

  return { nextVote, scoreDelta, upvoteDelta, downvoteDelta };
}

export function ThreadDetailPage({ route, navigation }: Props) {
  const { threadId } = route.params;
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [thread, setThread] = useState<Thread | null>(null);
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [replyDraft, setReplyDraft] = useState('');
  const [postingReply, setPostingReply] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyDraft, setEditingReplyDraft] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  const socketRef = useRef<ReturnType<typeof createThreadsSocket> | null>(null);

  // Initialize token and userId
  useEffect(() => {
    const initToken = async () => {
      const token = await getValidAccessToken();

      if (!token) {
        navigation.replace('Login');
        return;
      }

      setAccessToken(token);
      setCurrentUserId(decodeUserId(token));
    };
    void initToken();
  }, [navigation]);

  // Load thread and replies
  useEffect(() => {
    if (!accessToken) return;

    const loadThreadData = async () => {
      try {
        setError(null);
        setLoading(true);
        const [threadData, repliesData] = await Promise.all([
          getThread(accessToken, threadId),
          listReplies(accessToken, { threadId, take: 100, sortBy: 'newest' }),
        ]);
        setThread(threadData.thread);
        setReplies(repliesData.replies.filter((r) => r.status !== 'DELETED'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load discussion');
      } finally {
        setLoading(false);
      }
    };

    void loadThreadData();
  }, [accessToken, threadId]);

  // Socket setup for real-time updates
  useEffect(() => {
    if (!accessToken || !threadId) return;

    const socket = createThreadsSocket(accessToken);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('threads:join', { threadId });
    });

    socket.on('threads:reply-posted', (payload: { threadId: string; reply: ThreadReply }) => {
      if (payload.threadId !== threadId) return;
      if (payload.reply.status === 'DELETED') return;
      setReplies((prev) => [payload.reply, ...prev]);
      if (thread) {
        setThread((prev) => (prev ? { ...prev, replyCount: prev.replyCount + 1 } : prev));
      }
    });

    socket.on(
      'threads:reply-voted',
      (payload: {
        threadId: string;
        replyId: string;
        voteScore: number;
        upvoteCount: number;
        downvoteCount: number;
      }) => {
        if (payload.threadId !== threadId) return;
        setReplies((prev) =>
          prev.map((reply) =>
            reply.id === payload.replyId
              ? {
                  ...reply,
                  voteScore: payload.voteScore,
                  upvoteCount: payload.upvoteCount,
                  downvoteCount: payload.downvoteCount,
                }
              : reply
          )
        );
      }
    );

    socket.on(
      'threads:thread-voted',
      (payload: {
        threadId: string;
        voteScore: number;
        upvoteCount: number;
        downvoteCount: number;
      }) => {
        if (payload.threadId !== threadId) return;
        setThread((prev) =>
          prev
            ? {
                ...prev,
                voteScore: payload.voteScore,
                upvoteCount: payload.upvoteCount,
                downvoteCount: payload.downvoteCount,
              }
            : prev
        );
      }
    );

    return () => {
      socket.emit('threads:leave', { threadId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, threadId]);

  const handleVoteThread = async (voteType: VoteType) => {
    if (!accessToken || !thread) return;

    const previousVote = thread.viewerVote ?? null;
    const transition = getVoteTransition(previousVote, voteType);

    try {
      setActionError(null);
      setThread((prev) =>
        prev
          ? {
              ...prev,
              voteScore: prev.voteScore + transition.scoreDelta,
              upvoteCount: Math.max(0, (prev.upvoteCount ?? 0) + transition.upvoteDelta),
              downvoteCount: Math.max(0, (prev.downvoteCount ?? 0) + transition.downvoteDelta),
              viewerVote: transition.nextVote,
            }
          : prev
      );
      await voteThread(accessToken, threadId, voteType);
    } catch (err) {
      setThread((prev) =>
        prev
          ? {
              ...prev,
              voteScore: prev.voteScore - transition.scoreDelta,
              upvoteCount: Math.max(0, (prev.upvoteCount ?? 0) - transition.upvoteDelta),
              downvoteCount: Math.max(0, (prev.downvoteCount ?? 0) - transition.downvoteDelta),
              viewerVote: previousVote,
            }
          : prev
      );
      setActionError(err instanceof Error ? err.message : 'Failed to vote');
    }
  };

  const handleVoteReply = async (replyId: string, voteType: VoteType) => {
    if (!accessToken) return;

    const targetReply = replies.find((r) => r.id === replyId);
    if (!targetReply) return;

    const previousVote = targetReply.viewerVote ?? null;
    const transition = getVoteTransition(previousVote, voteType);

    try {
      setActionError(null);
      setReplies((prev) =>
        prev.map((reply) =>
          reply.id === replyId
            ? {
                ...reply,
                voteScore: reply.voteScore + transition.scoreDelta,
                upvoteCount: Math.max(0, (reply.upvoteCount ?? 0) + transition.upvoteDelta),
                downvoteCount: Math.max(0, (reply.downvoteCount ?? 0) + transition.downvoteDelta),
                viewerVote: transition.nextVote,
              }
            : reply
        )
      );
      await voteReply(accessToken, threadId, replyId, voteType);
    } catch (err) {
      setReplies((prev) =>
        prev.map((reply) =>
          reply.id === replyId
            ? {
                ...reply,
                voteScore: reply.voteScore - transition.scoreDelta,
                upvoteCount: Math.max(0, (reply.upvoteCount ?? 0) - transition.upvoteDelta),
                downvoteCount: Math.max(0, (reply.downvoteCount ?? 0) - transition.downvoteDelta),
                viewerVote: previousVote,
              }
            : reply
        )
      );
      setActionError(err instanceof Error ? err.message : 'Failed to vote');
    }
  };

  const handlePostReply = async () => {
    if (!accessToken || !replyDraft.trim()) return;

    try {
      setPostingReply(true);
      setActionError(null);
      const { reply } = await postReply(accessToken, {
        threadId,
        content: replyDraft.trim(),
      });
      setReplies((prev) => [reply, ...prev]);
      setReplyDraft('');
      if (thread) {
        setThread((prev) => (prev ? { ...prev, replyCount: prev.replyCount + 1 } : prev));
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to post reply');
    } finally {
      setPostingReply(false);
    }
  };

  const handleEditReply = async (replyId: string) => {
    if (!accessToken || !editingReplyDraft.trim()) return;

    try {
      setActionError(null);
      await editReply(accessToken, threadId, replyId, editingReplyDraft.trim());
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId ? { ...r, content: editingReplyDraft.trim(), status: 'EDITED' } : r
        )
      );
      setShowEditModal(false);
      setEditingReplyId(null);
      setEditingReplyDraft('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to edit reply');
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!accessToken) return;

    try {
      setActionError(null);
      await deleteReply(accessToken, threadId, replyId);
      setReplies((prev) => prev.filter((r) => r.id !== replyId));
      if (thread) {
        setThread((prev) => (prev ? { ...prev, replyCount: Math.max(0, prev.replyCount - 1) } : prev));
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete reply');
    }
  };

  const beginEditReply = (reply: ThreadReply) => {
    setEditingReplyId(reply.id);
    setEditingReplyDraft(reply.content);
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#f5f8ff]">
        <StatusBar style="dark" />
        <View className="flex-row items-center justify-between border-b border-[#e6edf7] bg-white px-4 py-4">
          <Pressable onPress={() => navigation.goBack()}>
            <FontAwesomeIcon icon={faArrowLeft as IconProp} size={20} color="#2f64f6" />
          </Pressable>
          <Text className="text-lg font-bold text-[#101d36]">Discussion</Text>
          <View style={{ width: 20 }} />
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm font-semibold text-[#7182a0]">Loading discussion…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !thread) {
    return (
      <SafeAreaView className="flex-1 bg-[#f5f8ff]">
        <StatusBar style="dark" />
        <View className="flex-row items-center justify-between border-b border-[#e6edf7] bg-white px-4 py-4">
          <Pressable onPress={() => navigation.goBack()}>
            <FontAwesomeIcon icon={faArrowLeft as IconProp} size={20} color="#2f64f6" />
          </Pressable>
          <Text className="text-lg font-bold text-[#101d36]">Discussion</Text>
          <View style={{ width: 20 }} />
        </View>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center text-sm font-semibold text-[#d24f4f]">
            {error ?? 'Discussion not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const threadAuthorLabel = thread.authorName ?? thread.authorId.slice(0, 8);

  return (
    <SafeAreaView className="flex-1 bg-[#f5f8ff]">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-[#e6edf7] bg-white px-4 py-4">
        <Pressable onPress={() => navigation.goBack()}>
          <FontAwesomeIcon icon={faArrowLeft as IconProp} size={20} color="#2f64f6" />
        </Pressable>
        <Text className="text-lg font-bold text-[#101d36]">Discussion</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Error Banner */}
        {actionError && (
          <View className="mx-4 mt-3 rounded-2xl border border-[#fbb5b5] bg-[#ffe8e8] px-4 py-3">
            <Text className="text-sm font-semibold text-[#d24f4f]">{actionError}</Text>
          </View>
        )}

        {/* Thread */}
        <View className="mx-4 mt-4 rounded-2xl border border-[#e6edf8] bg-white p-4">
          {/* Author & Meta */}
          <View className="flex-row items-start justify-between gap-3">
            <Text className="text-sm font-bold text-[#16233f]">{threadAuthorLabel}</Text>
            <Text className="text-xs font-medium text-[#8796af]">
              {formatRelativeDate(thread.createdAt)}
            </Text>
          </View>

          {/* Title */}
          <Text className="mt-2 text-lg font-bold leading-6 text-[#101d36]">{thread.title}</Text>

          {/* Description */}
          {thread.description && (
            <Text className="mt-2 text-sm leading-5 text-[#5f7090]">{thread.description}</Text>
          )}

          {/* Vote Section */}
          <View className="mt-4 flex-row items-center gap-4">
            <Pressable
              onPress={() => void handleVoteThread('UPVOTE')}
              className="flex-row items-center gap-1 rounded-lg px-3 py-2"
              style={{
                backgroundColor:
                  thread.viewerVote === 'UPVOTE' ? '#eaf1ff' : 'transparent',
              }}
            >
              <FontAwesomeIcon
                icon={faThumbsUp as IconProp}
                size={14}
                color={thread.viewerVote === 'UPVOTE' ? '#2f64f6' : '#6a7b98'}
              />
              <Text
                className="text-sm font-semibold"
                style={{
                  color: thread.viewerVote === 'UPVOTE' ? '#2f64f6' : '#6a7b98',
                }}
              >
                {thread.upvoteCount ?? 0}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void handleVoteThread('DOWNVOTE')}
              className="flex-row items-center gap-1 rounded-lg px-3 py-2"
              style={{
                backgroundColor:
                  thread.viewerVote === 'DOWNVOTE' ? '#ffe8e8' : 'transparent',
              }}
            >
              <FontAwesomeIcon
                icon={faThumbsDown as IconProp}
                size={14}
                color={thread.viewerVote === 'DOWNVOTE' ? '#d24f4f' : '#6a7b98'}
              />
              <Text
                className="text-sm font-semibold"
                style={{
                  color: thread.viewerVote === 'DOWNVOTE' ? '#d24f4f' : '#6a7b98',
                }}
              >
                {thread.downvoteCount ?? 0}
              </Text>
            </Pressable>

            <Text className="text-sm font-medium text-[#8796af]">
              {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
            </Text>
          </View>
        </View>

        {/* Reply Composer */}
        <View className="mx-4 mt-4 rounded-2xl border border-[#e6edf8] bg-white p-4">
          <Text className="text-sm font-semibold text-[#6f829f]">Add a reply</Text>
          <TextInput
            value={replyDraft}
            onChangeText={setReplyDraft}
            placeholder="Share your thoughts..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            editable={!postingReply}
            className="mt-2 rounded-2xl border border-[#dde6f5] bg-white p-3 text-sm text-[#1f2937]"
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={() => setReplyDraft('')}
              disabled={postingReply}
              className="flex-1 rounded-lg border border-[#dde6f5] bg-white px-3 py-2"
            >
              <Text className="text-center text-sm font-semibold text-[#5f7291]">Clear</Text>
            </Pressable>
            <Pressable
              onPress={() => void handlePostReply()}
              disabled={postingReply || !replyDraft.trim()}
              className={`flex-1 rounded-lg px-3 py-2 ${
                postingReply || !replyDraft.trim() ? 'bg-[#a8bde8]' : 'bg-[#2f64f6]'
              }`}
            >
              <Text className="text-center text-sm font-bold text-white">
                {postingReply ? 'Posting…' : 'Post'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Replies List */}
        <View className="mx-4 mt-4 gap-3 pb-8">
          {replies.length === 0 ? (
            <View className="items-center justify-center rounded-2xl border border-dashed border-[#d8e2f4] bg-[#fafcff] px-4 py-6">
              <Text className="text-sm font-semibold text-[#7182a0]">Be the first to reply!</Text>
            </View>
          ) : (
            replies.map((reply) => (
              <ReplyItem
                key={reply.id}
                reply={reply}
                isAuthor={currentUserId === reply.authorId}
                onVote={(voteType) => void handleVoteReply(reply.id, voteType)}
                onEdit={() => beginEditReply(reply)}
                onDelete={() => void handleDeleteReply(reply.id)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between border-b border-[#e6edf7] bg-white px-4 py-4">
            <Text className="text-lg font-bold text-[#101d36]">Edit Reply</Text>
            <Pressable onPress={() => setShowEditModal(false)}>
              <FontAwesomeIcon icon={faX as IconProp} size={20} color="#6a7b98" />
            </Pressable>
          </View>
          <View className="flex-1 gap-4 px-4 py-4">
            <TextInput
              value={editingReplyDraft}
              onChangeText={setEditingReplyDraft}
              placeholder="Edit your reply..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={5}
              className="rounded-2xl border border-[#dde6f5] bg-white p-3 text-sm text-[#1f2937]"
              style={{ minHeight: 120, textAlignVertical: 'top', flex: 1 }}
            />
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setShowEditModal(false)}
                className="flex-1 rounded-lg border border-[#dde6f5] bg-white px-3 py-3"
              >
                <Text className="text-center text-sm font-semibold text-[#5f7291]">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (editingReplyId) {
                    void handleEditReply(editingReplyId);
                  }
                }}
                disabled={!editingReplyDraft.trim()}
                className={`flex-1 rounded-lg px-3 py-3 ${
                  !editingReplyDraft.trim() ? 'bg-[#a8bde8]' : 'bg-[#2f64f6]'
                }`}
              >
                <Text className="text-center text-sm font-bold text-white">Save</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function ReplyItem({
  reply,
  isAuthor,
  onVote,
  onEdit,
  onDelete,
}: {
  reply: ThreadReply;
  isAuthor: boolean;
  onVote: (voteType: VoteType) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const authorLabel = reply.authorName ?? reply.authorId.slice(0, 8);

  return (
    <View className="rounded-2xl border border-[#e6edf8] bg-white p-3.5">
      {/* Author & Meta */}
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-bold text-[#16233f]">{authorLabel}</Text>
          <Text className="mt-1 text-xs font-medium text-[#8796af]">
            {formatRelativeDate(reply.createdAt)}
            {reply.status === 'EDITED' && ' • edited'}
          </Text>
        </View>
      </View>

      {/* Content */}
      <Text className="mt-2 text-sm leading-5 text-[#182842]">{reply.content}</Text>

      {/* Vote & Actions */}
      <View className="mt-3 flex-row items-center gap-2">
        <Pressable
          onPress={() => onVote('UPVOTE')}
          className="flex-row items-center gap-1 rounded-lg px-2 py-1"
          style={{
            backgroundColor: reply.viewerVote === 'UPVOTE' ? '#eaf1ff' : 'transparent',
          }}
        >
          <FontAwesomeIcon
            icon={faThumbsUp as IconProp}
            size={12}
            color={reply.viewerVote === 'UPVOTE' ? '#2f64f6' : '#6a7b98'}
          />
          <Text
            className="text-xs font-semibold"
            style={{
              color: reply.viewerVote === 'UPVOTE' ? '#2f64f6' : '#6a7b98',
            }}
          >
            {reply.upvoteCount ?? 0}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onVote('DOWNVOTE')}
          className="flex-row items-center gap-1 rounded-lg px-2 py-1"
          style={{
            backgroundColor: reply.viewerVote === 'DOWNVOTE' ? '#ffe8e8' : 'transparent',
          }}
        >
          <FontAwesomeIcon
            icon={faThumbsDown as IconProp}
            size={12}
            color={reply.viewerVote === 'DOWNVOTE' ? '#d24f4f' : '#6a7b98'}
          />
          <Text
            className="text-xs font-semibold"
            style={{
              color: reply.viewerVote === 'DOWNVOTE' ? '#d24f4f' : '#6a7b98',
            }}
          >
            {reply.downvoteCount ?? 0}
          </Text>
        </Pressable>

        {isAuthor && (
          <View className="ml-auto flex-row gap-1">
            <Pressable
              onPress={onEdit}
              className="rounded-lg bg-[#eaf1ff] px-2 py-1"
            >
              <Text className="text-xs font-semibold text-[#2f64f6]">Edit</Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              className="rounded-lg bg-[#ffe8e8] px-2 py-1"
            >
              <Text className="text-xs font-semibold text-[#d24f4f]">Delete</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

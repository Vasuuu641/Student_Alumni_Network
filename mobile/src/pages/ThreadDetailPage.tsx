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
import { useTheme } from '../theme/theme';

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
  const { tokens } = useTheme();
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

  useEffect(() => {
    const initToken = async () => {
      const token = await getValidAccessToken();
      if (!token) { navigation.replace('Login'); return; }
      setAccessToken(token);
      setCurrentUserId(decodeUserId(token));
    };
    void initToken();
  }, [navigation]);

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

  useEffect(() => {
    if (!accessToken || !threadId) return;
    const socket = createThreadsSocket(accessToken);
    socketRef.current = socket;
    socket.on('connect', () => { socket.emit('threads:join', { threadId }); });
    socket.on('threads:reply-posted', (payload: { threadId: string; reply: ThreadReply }) => {
      if (payload.threadId !== threadId) return;
      if (payload.reply.status === 'DELETED') return;
      setReplies((prev) => [payload.reply, ...prev]);
      if (thread) setThread((prev) => (prev ? { ...prev, replyCount: prev.replyCount + 1 } : prev));
    });
    socket.on('threads:reply-voted', (payload: { threadId: string; replyId: string; voteScore: number; upvoteCount: number; downvoteCount: number }) => {
      if (payload.threadId !== threadId) return;
      setReplies((prev) => prev.map((reply) =>
        reply.id === payload.replyId ? { ...reply, voteScore: payload.voteScore, upvoteCount: payload.upvoteCount, downvoteCount: payload.downvoteCount } : reply
      ));
    });
    socket.on('threads:thread-voted', (payload: { threadId: string; voteScore: number; upvoteCount: number; downvoteCount: number }) => {
      if (payload.threadId !== threadId) return;
      setThread((prev) => prev ? { ...prev, voteScore: payload.voteScore, upvoteCount: payload.upvoteCount, downvoteCount: payload.downvoteCount } : prev);
    });
    return () => { socket.emit('threads:leave', { threadId }); socket.disconnect(); socketRef.current = null; };
  }, [accessToken, threadId]);

  const handleVoteThread = async (voteType: VoteType) => {
    if (!accessToken || !thread) return;
    const previousVote = thread.viewerVote ?? null;
    const transition = getVoteTransition(previousVote, voteType);
    try {
      setActionError(null);
      setThread((prev) => prev ? { ...prev, voteScore: prev.voteScore + transition.scoreDelta, upvoteCount: Math.max(0, (prev.upvoteCount ?? 0) + transition.upvoteDelta), downvoteCount: Math.max(0, (prev.downvoteCount ?? 0) + transition.downvoteDelta), viewerVote: transition.nextVote } : prev);
      await voteThread(accessToken, threadId, voteType);
    } catch (err) {
      setThread((prev) => prev ? { ...prev, voteScore: prev.voteScore - transition.scoreDelta, upvoteCount: Math.max(0, (prev.upvoteCount ?? 0) - transition.upvoteDelta), downvoteCount: Math.max(0, (prev.downvoteCount ?? 0) - transition.downvoteDelta), viewerVote: previousVote } : prev);
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
      setReplies((prev) => prev.map((reply) => reply.id === replyId ? { ...reply, voteScore: reply.voteScore + transition.scoreDelta, upvoteCount: Math.max(0, (reply.upvoteCount ?? 0) + transition.upvoteDelta), downvoteCount: Math.max(0, (reply.downvoteCount ?? 0) + transition.downvoteDelta), viewerVote: transition.nextVote } : reply));
      await voteReply(accessToken, threadId, replyId, voteType);
    } catch (err) {
      setReplies((prev) => prev.map((reply) => reply.id === replyId ? { ...reply, voteScore: reply.voteScore - transition.scoreDelta, upvoteCount: Math.max(0, (reply.upvoteCount ?? 0) - transition.upvoteDelta), downvoteCount: Math.max(0, (reply.downvoteCount ?? 0) - transition.downvoteDelta), viewerVote: previousVote } : reply));
      setActionError(err instanceof Error ? err.message : 'Failed to vote');
    }
  };

  const handlePostReply = async () => {
    if (!accessToken || !replyDraft.trim()) return;
    try {
      setPostingReply(true);
      setActionError(null);
      const { reply } = await postReply(accessToken, { threadId, content: replyDraft.trim() });
      setReplies((prev) => [reply, ...prev]);
      setReplyDraft('');
      if (thread) setThread((prev) => (prev ? { ...prev, replyCount: prev.replyCount + 1 } : prev));
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
      setReplies((prev) => prev.map((r) => r.id === replyId ? { ...r, content: editingReplyDraft.trim(), status: 'EDITED' } : r));
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
      if (thread) setThread((prev) => (prev ? { ...prev, replyCount: Math.max(0, prev.replyCount - 1) } : prev));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete reply');
    }
  };

  const beginEditReply = (reply: ThreadReply) => {
    setEditingReplyId(reply.id);
    setEditingReplyDraft(reply.content);
    setShowEditModal(true);
  };

  const Header = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 16, paddingVertical: 16 }}>
      <Pressable onPress={() => navigation.goBack()}>
        <FontAwesomeIcon icon={faArrowLeft as IconProp} size={20} color={tokens.primary} />
      </Pressable>
      <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.text }}>Discussion</Text>
      <View style={{ width: 20 }} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
        <StatusBar style={tokens.name === 'midnight' ? 'light' : 'dark'} />
        <Header />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.muted }}>Loading discussion…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !thread) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
        <StatusBar style={tokens.name === 'midnight' ? 'light' : 'dark'} />
        <Header />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
          <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: '600', color: tokens.danger }}>
            {error ?? 'Discussion not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const threadAuthorLabel = thread.authorName ?? thread.authorId.slice(0, 8);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
      <StatusBar style={tokens.name === 'midnight' ? 'light' : 'dark'} />

      <Header />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Error Banner */}
        {actionError && (
          <View style={{ marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: tokens.danger, backgroundColor: tokens.name === 'midnight' ? '#3a1a1e' : '#ffe8e8', paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.danger }}>{actionError}</Text>
          </View>
        )}

        {/* Thread Card */}
        <View style={{ marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.text }}>{threadAuthorLabel}</Text>
            <Text style={{ fontSize: 12, fontWeight: '500', color: tokens.muted }}>{formatRelativeDate(thread.createdAt)}</Text>
          </View>
          <Text style={{ marginTop: 8, fontSize: 18, fontWeight: '700', lineHeight: 24, color: tokens.text }}>{thread.title}</Text>
          {thread.description && (
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: tokens.muted }}>{thread.description}</Text>
          )}
          <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Pressable
              onPress={() => void handleVoteThread('UPVOTE')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: thread.viewerVote === 'UPVOTE' ? tokens.primarySoft : 'transparent' }}
            >
              <FontAwesomeIcon icon={faThumbsUp as IconProp} size={14} color={thread.viewerVote === 'UPVOTE' ? tokens.primary : tokens.muted} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: thread.viewerVote === 'UPVOTE' ? tokens.primary : tokens.muted }}>{thread.upvoteCount ?? 0}</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleVoteThread('DOWNVOTE')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: thread.viewerVote === 'DOWNVOTE' ? (tokens.name === 'midnight' ? '#3a1a1e' : '#ffe8e8') : 'transparent' }}
            >
              <FontAwesomeIcon icon={faThumbsDown as IconProp} size={14} color={thread.viewerVote === 'DOWNVOTE' ? tokens.danger : tokens.muted} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: thread.viewerVote === 'DOWNVOTE' ? tokens.danger : tokens.muted }}>{thread.downvoteCount ?? 0}</Text>
            </Pressable>
            <Text style={{ fontSize: 14, fontWeight: '500', color: tokens.muted }}>{thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}</Text>
          </View>
        </View>

        {/* Reply Composer */}
        <View style={{ marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.muted }}>Add a reply</Text>
          <TextInput
            value={replyDraft}
            onChangeText={setReplyDraft}
            placeholder="Share your thoughts..."
            placeholderTextColor={tokens.muted}
            multiline
            numberOfLines={3}
            editable={!postingReply}
            style={{ marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, padding: 12, fontSize: 14, color: tokens.text, minHeight: 80, textAlignVertical: 'top' }}
          />
          <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setReplyDraft('')}
              disabled={postingReply}
              style={{ flex: 1, borderRadius: 8, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingVertical: 8 }}
            >
              <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: '600', color: tokens.muted }}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={() => void handlePostReply()}
              disabled={postingReply || !replyDraft.trim()}
              style={{ flex: 1, borderRadius: 8, paddingVertical: 8, backgroundColor: postingReply || !replyDraft.trim() ? tokens.primarySoft : tokens.primary }}
            >
              <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: '700', color: postingReply || !replyDraft.trim() ? tokens.primary : '#fff' }}>
                {postingReply ? 'Posting…' : 'Post'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Replies List */}
        <View style={{ marginHorizontal: 16, marginTop: 16, gap: 12, paddingBottom: 32 }}>
          {replies.length === 0 ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 16, paddingVertical: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.muted }}>Be the first to reply!</Text>
            </View>
          ) : (
            replies.map((reply) => (
              <ReplyItem
                key={reply.id}
                reply={reply}
                tokens={tokens}
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
        <SafeAreaView style={{ flex: 1, backgroundColor: tokens.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: tokens.border, paddingHorizontal: 16, paddingVertical: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.text }}>Edit Reply</Text>
            <Pressable onPress={() => setShowEditModal(false)}>
              <FontAwesomeIcon icon={faX as IconProp} size={20} color={tokens.muted} />
            </Pressable>
          </View>
          <View style={{ flex: 1, gap: 16, paddingHorizontal: 16, paddingVertical: 16 }}>
            <TextInput
              value={editingReplyDraft}
              onChangeText={setEditingReplyDraft}
              placeholder="Edit your reply..."
              placeholderTextColor={tokens.muted}
              multiline
              numberOfLines={5}
              style={{ borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, padding: 12, fontSize: 14, color: tokens.text, minHeight: 120, textAlignVertical: 'top', flex: 1 }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setShowEditModal(false)}
                style={{ flex: 1, borderRadius: 8, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingVertical: 12 }}
              >
                <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: '600', color: tokens.muted }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => { if (editingReplyId) void handleEditReply(editingReplyId); }}
                disabled={!editingReplyDraft.trim()}
                style={{ flex: 1, borderRadius: 8, paddingVertical: 12, backgroundColor: !editingReplyDraft.trim() ? tokens.primarySoft : tokens.primary }}
              >
                <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: '700', color: !editingReplyDraft.trim() ? tokens.primary : '#fff' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function ReplyItem({ reply, tokens, isAuthor, onVote, onEdit, onDelete }: { reply: ThreadReply; tokens: any; isAuthor: boolean; onVote: (voteType: VoteType) => void; onEdit: () => void; onDelete: () => void }) {
  const authorLabel = reply.authorName ?? reply.authorId.slice(0, 8);
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.text }}>{authorLabel}</Text>
          <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '500', color: tokens.muted }}>
            {formatRelativeDate(reply.createdAt)}{reply.status === 'EDITED' && ' • edited'}
          </Text>
        </View>
      </View>
      <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: tokens.text }}>{reply.content}</Text>
      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable
          onPress={() => onVote('UPVOTE')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: reply.viewerVote === 'UPVOTE' ? tokens.primarySoft : 'transparent' }}
        >
          <FontAwesomeIcon icon={faThumbsUp as IconProp} size={12} color={reply.viewerVote === 'UPVOTE' ? tokens.primary : tokens.muted} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: reply.viewerVote === 'UPVOTE' ? tokens.primary : tokens.muted }}>{reply.upvoteCount ?? 0}</Text>
        </Pressable>
        <Pressable
          onPress={() => onVote('DOWNVOTE')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: reply.viewerVote === 'DOWNVOTE' ? (tokens.name === 'midnight' ? '#3a1a1e' : '#ffe8e8') : 'transparent' }}
        >
          <FontAwesomeIcon icon={faThumbsDown as IconProp} size={12} color={reply.viewerVote === 'DOWNVOTE' ? tokens.danger : tokens.muted} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: reply.viewerVote === 'DOWNVOTE' ? tokens.danger : tokens.muted }}>{reply.downvoteCount ?? 0}</Text>
        </Pressable>
        {isAuthor && (
          <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 4 }}>
            <Pressable onPress={onEdit} style={{ borderRadius: 8, backgroundColor: tokens.primarySoft, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.primary }}>Edit</Text>
            </Pressable>
            <Pressable onPress={onDelete} style={{ borderRadius: 8, backgroundColor: tokens.name === 'midnight' ? '#3a1a1e' : '#ffe8e8', paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.danger }}>Delete</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

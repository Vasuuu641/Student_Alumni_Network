// components/notes/MobileAIInsightsPanel.tsx
// Mobile equivalent of src/components/notes/RelatedThreadsPanel.tsx
// Renders as a bottom sheet Modal with two views:
//   1. Suggestions list  — thread cards with similarity scores
//   2. Discussion preview — thread detail + replies

import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ArrowLeft,
  MessageCircle,
  TrendingUp,
  Lightbulb,
  X,
  Sparkles,
} from 'lucide-react-native'

import { getThread, listReplies, type Thread, type ThreadReply } from '../../api/threads.api'
import type { RelatedThread } from '../../api/notes.api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  token: string
  threads: RelatedThread[]
  isLoading: boolean
  hasRequested: boolean
  canRequestSuggestions: boolean
  cooldownRemainingMs: number
  onRequestSuggestions: () => void
  visible: boolean
  onClose: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function similarityColor(score: number): string {
  if (score >= 0.8) return '#16a34a'   // green
  if (score >= 0.7) return '#2f64f6'   // blue
  if (score >= 0.6) return '#f59e0b'   // amber
  return '#94a3b8'                      // grey
}

function similarityBg(score: number): string {
  if (score >= 0.8) return '#dcfce7'
  if (score >= 0.7) return '#eaf1ff'
  if (score >= 0.6) return '#fef3c7'
  return '#f0f4fa'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MobileAIInsightsPanel({
  token,
  threads,
  isLoading,
  hasRequested,
  canRequestSuggestions,
  cooldownRemainingMs,
  onRequestSuggestions,
  visible,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets()
  const cooldownSeconds = Math.ceil(cooldownRemainingMs / 1000)

  // ─── Preview state ───────────────────────────────────────────────────────────
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [selectedReplies, setSelectedReplies] = useState<ThreadReply[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const hasPreviewOpen = selectedThreadId !== null
  const previewSummary = threads.find((t) => t.threadId === selectedThreadId) ?? null

  // ─── Open thread preview ─────────────────────────────────────────────────────
    const openPreview = useCallback(async (threadId: string) => {
    setSelectedThreadId(threadId)
    setPreviewLoading(true)
    setPreviewError(null)
    setSelectedThread(null)
    setSelectedReplies([])

      try {
      const [{ thread }, { replies }] = await Promise.all([
        getThread(token, threadId),                                    // ← token added
        listReplies(token, { threadId, sortBy: 'newest', take: 100 }), // ← token added
      ])
      setSelectedThread(thread)
      const sorted = replies
        .filter((r) => r.status !== 'DELETED')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      setSelectedReplies(sorted)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to load discussion')
    } finally {
      setPreviewLoading(false)
    }
  }, [token]) // ← token in deps


  // ─── Close preview (back to list) ────────────────────────────────────────────
  const closePreview = useCallback(() => {
    setSelectedThreadId(null)
    setSelectedThread(null)
    setSelectedReplies([])
    setPreviewError(null)
    setPreviewLoading(false)
  }, [])

  // ─── Close panel entirely ────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    closePreview()
    onClose()
  }, [closePreview, onClose])

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable className="absolute inset-0 bg-[rgba(10,20,40,0.4)]" onPress={handleClose} />

      <View
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[20px] px-5 pt-3"
        style={{ maxHeight: '85%', paddingBottom: insets.bottom + 16 }}
      >
        {/* Handle */}
        <View className="self-center w-9 h-1 rounded-full bg-[#dce6f3] mb-[14px]" />

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Lightbulb size={16} color="#f59e0b" />
            <Text className="text-[17px] font-bold text-[#101d36]">
              {hasPreviewOpen ? 'Discussion Preview' : 'AI Insights'}
            </Text>
          </View>
          <TouchableOpacity onPress={handleClose} hitSlop={12}>
            <X size={18} color="#5f7291" />
          </TouchableOpacity>
        </View>

        {/* ── Action bar ───────────────────────────────────────────────────────── */}
        <View className="mb-3">
          {hasPreviewOpen ? (
            <TouchableOpacity
              className="flex-row items-center gap-2 self-start px-3 py-2 rounded-lg bg-[#f0f4fa] border border-[#dce6f3]"
              onPress={closePreview}
              activeOpacity={0.7}
            >
              <ArrowLeft size={14} color="#5f7291" />
              <Text className="text-[13px] font-medium text-[#5f7291]">Back to suggestions</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className={`flex-row items-center justify-center gap-2 py-[11px] rounded-[10px] ${
                isLoading || !canRequestSuggestions || cooldownRemainingMs > 0
                  ? 'bg-[#e2e8f0] opacity-70'
                  : 'bg-[#2f64f6]'
              }`}
              onPress={onRequestSuggestions}
              disabled={isLoading || !canRequestSuggestions || cooldownRemainingMs > 0}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Sparkles size={14} color={cooldownRemainingMs > 0 || !canRequestSuggestions ? '#94a3b8' : '#fff'} />
              )}
              <Text className={`text-sm font-semibold ${
                cooldownRemainingMs > 0 || !canRequestSuggestions ? 'text-[#94a3b8]' : 'text-white'
              }`}>
                {isLoading
                  ? 'Finding suggestions…'
                  : cooldownRemainingMs > 0
                    ? `Try again in ${cooldownSeconds}s`
                    : !canRequestSuggestions
                      ? 'Write more to get suggestions'
                      : 'Get AI Suggestions'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Content ──────────────────────────────────────────────────────────── */}
        {hasPreviewOpen ? (
          <PreviewView
            thread={selectedThread}
            replies={selectedReplies}
            summary={previewSummary}
            loading={previewLoading}
            error={previewError}
          />
        ) : (
          <SuggestionsView
            threads={threads}
            isLoading={isLoading}
            hasRequested={hasRequested}
            canRequestSuggestions={canRequestSuggestions}
            onSelectThread={(id) => void openPreview(id)}
          />
        )}

        {/* ── Footer hint ──────────────────────────────────────────────────────── */}
        <Text className="text-[11px] text-[#94a3b8] text-center mt-3">
          {hasPreviewOpen
            ? 'Browse thread details without leaving your note.'
            : 'Suggestions are fetched only when you request them.'}
        </Text>
      </View>
    </Modal>
  )
}

// ─── Suggestions view ─────────────────────────────────────────────────────────

interface SuggestionsViewProps {
  threads: RelatedThread[]
  isLoading: boolean
  hasRequested: boolean
  canRequestSuggestions: boolean
  onSelectThread: (threadId: string) => void
}

function SuggestionsView({
  threads,
  isLoading,
  hasRequested,
  canRequestSuggestions,
  onSelectThread,
}: SuggestionsViewProps) {
  if (isLoading) {
    return (
      <View className="items-center justify-center py-10 gap-3">
        <ActivityIndicator color="#2f64f6" />
        <Text className="text-sm text-[#5f7291]">Finding discussions…</Text>
      </View>
    )
  }

  if (threads.length === 0) {
    return (
      <View className="items-center justify-center py-10 gap-3">
        <MessageCircle size={32} color="#94a3b8" strokeWidth={1.3} />
        <Text className="text-sm text-[#5f7291] text-center px-4">
          {!hasRequested
            ? 'Press Get AI Suggestions to find related discussions.'
            : canRequestSuggestions
              ? 'No related discussions found for this note yet.'
              : 'Write a bit more before requesting suggestions.'}
        </Text>
      </View>
    )
  }

  return (
    <FlatList
      data={threads}
      keyExtractor={(t) => t.threadId}
      style={{ maxHeight: 420 }}
      ItemSeparatorComponent={() => <View className="h-2" />}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <ThreadCard thread={item} onPress={() => onSelectThread(item.threadId)} />
      )}
    />
  )
}

// ─── Thread card ──────────────────────────────────────────────────────────────

interface ThreadCardProps {
  thread: RelatedThread
  onPress: () => void
}

function ThreadCard({ thread, onPress }: ThreadCardProps) {
  const pct = Math.round(thread.similarityScore * 100)
  const color = similarityColor(thread.similarityScore)
  const bg = similarityBg(thread.similarityScore)

  return (
    <TouchableOpacity
      className="flex-row bg-white rounded-xl border border-[#dce6f3] overflow-hidden"
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Similarity badge — left accent strip */}
      <View
        className="w-[52px] items-center justify-center py-3"
        style={{ backgroundColor: bg }}
      >
        <Text className="text-[13px] font-bold" style={{ color }}>{pct}%</Text>
        <Text className="text-[9px] font-medium mt-px" style={{ color }}>match</Text>
      </View>

      {/* Content */}
      <View className="flex-1 px-3 py-3 gap-1">
        <Text className="text-[13px] font-semibold text-[#101d36]" numberOfLines={2}>
          {thread.title}
        </Text>

        {!!thread.description && (
          <Text className="text-[11px] text-[#5f7291]" numberOfLines={2}>
            {thread.description.length > 90
              ? `${thread.description.slice(0, 90)}…`
              : thread.description}
          </Text>
        )}

        {/* Stats row */}
        <View className="flex-row items-center gap-3 mt-1">
          <View className="flex-row items-center gap-1">
            <MessageCircle size={11} color="#94a3b8" />
            <Text className="text-[11px] text-[#94a3b8]">{thread.replyCount}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <TrendingUp size={11} color="#94a3b8" />
            <Text className="text-[11px] text-[#94a3b8]">
              {thread.voteScore > 0 ? `+${thread.voteScore}` : thread.voteScore}
            </Text>
          </View>
          {/* Panel badge */}
          <View className={`px-[6px] py-px rounded-full ${thread.panel === 'ACADEMIC' ? 'bg-[#eaf1ff]' : 'bg-[#ede9fe]'}`}>
            <Text className={`text-[9px] font-semibold ${thread.panel === 'ACADEMIC' ? 'text-[#2f64f6]' : 'text-[#7c3aed]'}`}>
              {thread.panel === 'ACADEMIC' ? '📚 Academic' : '💼 Alumni'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Preview view ─────────────────────────────────────────────────────────────

interface PreviewViewProps {
  thread: Thread | null
  replies: ThreadReply[]
  summary: RelatedThread | null
  loading: boolean
  error: string | null
}

function PreviewView({ thread, replies, summary, loading, error }: PreviewViewProps) {
  if (loading) {
    return (
      <View className="items-center justify-center py-10 gap-3">
        <ActivityIndicator color="#2f64f6" />
        <Text className="text-sm text-[#5f7291]">Loading discussion…</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View className="items-center justify-center py-10 gap-3">
        <MessageCircle size={28} color="#94a3b8" strokeWidth={1.3} />
        <Text className="text-sm text-[#c53b4f] text-center px-4">{error}</Text>
      </View>
    )
  }

  if (!thread) {
    return (
      <View className="items-center justify-center py-10 gap-3">
        <MessageCircle size={28} color="#94a3b8" strokeWidth={1.3} />
        <Text className="text-sm text-[#5f7291]">Select a suggestion to preview.</Text>
      </View>
    )
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
      {/* Thread header card */}
      <View className="bg-[#f5f8ff] rounded-xl p-4 mb-3 border border-[#dce6f3] gap-2">
        <Text className="text-[15px] font-bold text-[#101d36]">{thread.title}</Text>

        {thread.description ? (
          <Text className="text-[13px] text-[#5f7291] leading-5">{thread.description}</Text>
        ) : (
          <Text className="text-[13px] text-[#94a3b8] italic">No description provided.</Text>
        )}

        {/* Meta row */}
        <View className="flex-row flex-wrap gap-2 mt-1">
          <View className={`px-2 py-px rounded-full ${thread.panel === 'ACADEMIC' ? 'bg-[#eaf1ff]' : 'bg-[#ede9fe]'}`}>
            <Text className={`text-[10px] font-semibold ${thread.panel === 'ACADEMIC' ? 'text-[#2f64f6]' : 'text-[#7c3aed]'}`}>
              {thread.panel === 'ACADEMIC' ? '📚 Academic' : '💼 Alumni'}
            </Text>
          </View>
          <View className="flex-row items-center gap-1 bg-[#f0f4fa] px-2 py-px rounded-full">
            <MessageCircle size={10} color="#5f7291" />
            <Text className="text-[10px] text-[#5f7291] font-medium">{thread.replyCount} replies</Text>
          </View>
          <View className="flex-row items-center gap-1 bg-[#f0f4fa] px-2 py-px rounded-full">
            <TrendingUp size={10} color="#5f7291" />
            <Text className="text-[10px] text-[#5f7291] font-medium">
              {thread.voteScore > 0 ? `+${thread.voteScore}` : thread.voteScore} score
            </Text>
          </View>
          {summary && (
            <View
              className="px-2 py-px rounded-full"
              style={{ backgroundColor: similarityBg(summary.similarityScore) }}
            >
              <Text
                className="text-[10px] font-semibold"
                style={{ color: similarityColor(summary.similarityScore) }}
              >
                {Math.round(summary.similarityScore * 100)}% match
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Replies */}
      <Text className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
        Replies ({replies.length})
      </Text>

      {replies.length === 0 ? (
        <View className="items-center py-6 gap-2">
          <MessageCircle size={20} color="#94a3b8" strokeWidth={1.3} />
          <Text className="text-xs text-[#94a3b8]">No replies yet.</Text>
        </View>
      ) : (
        <View className="gap-2">
          {replies.map((reply) => (
            <View key={reply.id} className="bg-white rounded-xl border border-[#dce6f3] p-3 gap-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-[12px] font-semibold text-[#101d36]">
                  {reply.authorName ?? 'Unknown user'}
                </Text>
                <Text className="text-[10px] text-[#94a3b8]">
                  {reply.voteScore > 0 ? `+${reply.voteScore}` : reply.voteScore} score
                </Text>
              </View>
              <Text className="text-[12px] text-[#5f7291] leading-[18px]">{reply.content}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Bottom padding */}
      <View className="h-4" />
    </ScrollView>
  )
}
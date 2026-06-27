// screens/NoteScreen.tsx
// Mobile equivalent of src/pages/NotePage.tsx
//
// The TenTap editor bridge lives in NoteEditorPane (child component) which
// only mounts once `note` has finished loading, eliminating the readiness
// race that previously caused blank content on first entry.
// Keyboard tracking is JS-only (useAnimatedKeyboardHeight) — no Reanimated
// or react-native-keyboard-controller required.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  BookmarkPlus,
  CheckCircle2,
  AlertCircle,
  FileText,
  History,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react-native'

import { getNote, updateNote, createCheckpoint } from '../api/notes.api'
import { getValidAccessToken } from '../lib/auth-session'
import { getRoleFromAccessToken } from '../lib/jwt'
import type { RootStackParamList } from '../navigation/root-stack'
import { MobileVersionHistoryPanel } from '../components/notes/MobileVersionHistoryPanel'
import { useNotePresence } from '../hooks/UseNotesPresence'
import { useRelatedThreads } from '../hooks/UseRelatedThreads'
import { MobileAIInsightsPanel } from '../components/notes/MobileInsightsPanel'
import { MobileSharePanel } from '../components/notes/MobileSharePanel'
import {
  NoteEditorPane,
  type NoteEditorPaneHandle,
  type SaveStatus,
} from '../components/notes/NoteEditorPane'

// ─── Types ────────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<RootStackParamList>
type NoteRoute = RouteProp<RootStackParamList, 'NoteScreen'>

interface NoteData {
  id: string
  title: string
  content: any
  ownerId: string
  status: 'ACTIVE' | 'ARCHIVED'
  role?: string
  updatedAt?: string
  createdAt?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeUserId(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.userId ?? null
  } catch {
    return null
  }
}

function tiptapJsonToHtml(json: any): string {
  if (!json) return ''
  if (typeof json === 'string') return json
  if (typeof json === 'object' && json.type === 'doc') {
    return jsonNodeToHtml(json)
  }
  return ''
}

function jsonNodeToHtml(node: any): string {
  if (!node) return ''
  if (node.type === 'doc') return (node.content ?? []).map(jsonNodeToHtml).join('')
  if (node.type === 'paragraph') {
    const inner = (node.content ?? []).map(jsonNodeToHtml).join('')
    return `<p>${inner || '<br>'}</p>`
  }
  if (node.type === 'heading') {
    const level = node.attrs?.level ?? 1
    const inner = (node.content ?? []).map(jsonNodeToHtml).join('')
    return `<h${level}>${inner}</h${level}>`
  }
  if (node.type === 'bulletList') return `<ul>${(node.content ?? []).map(jsonNodeToHtml).join('')}</ul>`
  if (node.type === 'orderedList') return `<ol>${(node.content ?? []).map(jsonNodeToHtml).join('')}</ol>`
  if (node.type === 'listItem') return `<li>${(node.content ?? []).map(jsonNodeToHtml).join('')}</li>`
  if (node.type === 'blockquote') return `<blockquote>${(node.content ?? []).map(jsonNodeToHtml).join('')}</blockquote>`
  if (node.type === 'codeBlock') return `<pre><code>${(node.content ?? []).map(jsonNodeToHtml).join('')}</code></pre>`
  if (node.type === 'horizontalRule') return '<hr>'
  if (node.type === 'text') {
    let text = node.text ?? ''
    const marks: string[] = node.marks?.map((m: any) => m.type) ?? []
    if (marks.includes('bold')) text = `<strong>${text}</strong>`
    if (marks.includes('italic')) text = `<em>${text}</em>`
    if (marks.includes('strike')) text = `<s>${text}</s>`
    if (marks.includes('code')) text = `<code>${text}</code>`
    return text
  }
  return (node.content ?? []).map(jsonNodeToHtml).join('')
}

function isNoteContentEmpty(content: any): boolean {
  return !content ||
    (typeof content === 'object' &&
      Array.isArray(content?.content) &&
      content.content.length === 0) ||
    (typeof content === 'string' && content.trim() === '')
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function NoteScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<NoteRoute>()
  const insets = useSafeAreaInsets()
  const noteId: string = (route.params as any)?.noteId ?? ''

  const [token, setToken] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    getValidAccessToken().then((t) => {
      setToken(t)
      const r = t ? String(getRoleFromAccessToken(t)) : null
      setRole(r)
      setCurrentUserId(t ? decodeUserId(t) : null)
      setAuthReady(true)
    })
  }, [])

  const canAccessNotes = role !== 'ALUMNI'

  const [note, setNote] = useState<NoteData | null>(null)
  const [loadingNote, setLoadingNote] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showAIInsights, setShowAIInsights] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [savingCheckpoint, setSavingCheckpoint] = useState(false)

  const [titleDraft, setTitleDraft] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const titleInputRef = useRef<TextInput>(null)

  const [liveHtmlContent, setLiveHtmlContent] = useState('')
  const editorPaneRef = useRef<NoteEditorPaneHandle>(null)

  const canEdit = authReady && canAccessNotes && role !== 'ALUMNI'
  const isOwner = note ? note.ownerId === currentUserId : false
  const isArchived = note?.status === 'ARCHIVED'

  // ─── Presence ──────────────────────────────────────────────────────────────
  const { onlineCount, othersOnline } = useNotePresence({
    noteId,
    userId: currentUserId,
    enabled: !!note && authReady,
  })

  // ─── AI Insights ───────────────────────────────────────────────────────────
  const initialHtml = note ? tiptapJsonToHtml(note.content) : ''
  const plainTextContent = (liveHtmlContent || initialHtml)
    .replace(/<[^>]*>/g, '')
    .trim()

  const {
    threads: relatedThreads,
    isLoading: threadsLoading,
    hasRequested: threadsRequested,
    canRequestSuggestions,
    cooldownRemainingMs,
    requestSuggestions,
  } = useRelatedThreads({
    noteId,
    token,
    noteContent: plainTextContent,
    title: note?.title ?? '',
    contentJson: note?.content ?? null,
    enabled: showAIInsights,
  })

  const noteRoleLabel: string = (() => {
    const r = note?.role?.toUpperCase()
    if (r === 'OWNER' || isOwner) return 'Owner'
    if (r === 'EDITOR' || canEdit) return 'Editor'
    return 'Viewer'
  })()

  const noteRoleBg: string = (isOwner || note?.role?.toUpperCase() === 'OWNER')
    ? 'bg-[#eaf1ff]' : 'bg-[#f0f4fa]'
  const noteRoleColor: string = (isOwner || note?.role?.toUpperCase() === 'OWNER')
    ? 'text-[#2f64f6]' : canEdit ? 'text-[#5f7291]' : 'text-[#94a3b8]'

  useEffect(() => {
    if (!authReady) return
    if (!token) navigation.replace('Login', undefined)
    else if (!canAccessNotes) navigation.replace('Notes', undefined)
  }, [authReady, token, canAccessNotes, navigation])

  const fetchNote = useCallback(async () => {
    if (!authReady || !noteId || !token) {
      if (authReady) setLoadingNote(false)
      return
    }
    try {
      setFetchError(null)
      const fetchedNote = await getNote(token, noteId)
      setNote(fetchedNote)
      setTitleDraft(fetchedNote.title)
    } catch {
      setFetchError('Failed to load note')
    } finally {
      setLoadingNote(false)
    }
  }, [authReady, noteId, token])

  useEffect(() => { fetchNote() }, [fetchNote])

  const flushPendingSave = useCallback(async () => {
    await editorPaneRef.current?.flushPendingSave()
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        void flushPendingSave()
      }
    })
    return () => sub.remove()
  }, [flushPendingSave])

  useEffect(() => {
    return () => { void flushPendingSave() }
  }, [flushPendingSave])

  function startEditTitle() {
    if (!isOwner) return
    setEditingTitle(true)
    setTimeout(() => titleInputRef.current?.focus(), 30)
  }

  async function commitTitle() {
    setEditingTitle(false)
    const trimmed = titleDraft.trim() || 'Untitled document'
    if (trimmed === note?.title || !token) return
    try {
      await updateNote(token, noteId, { title: trimmed })
      setNote((prev) => prev ? { ...prev, title: trimmed } : prev)
    } catch {
      setTitleDraft(note?.title ?? '')
    }
  }

  const handleToggleArchive = async () => {
    if (!token || !note || !isOwner) return
    const nextStatus = isArchived ? 'ACTIVE' : 'ARCHIVED'
    try {
      setArchiving(true)
      await updateNote(token, noteId, { status: nextStatus })
      setNote((prev) => prev ? { ...prev, status: nextStatus } : prev)
    } catch {
      // silently fail
    } finally {
      setArchiving(false)
    }
  }

  const handleSaveCheckpoint = async () => {
    if (!token) return
    try {
      setSavingCheckpoint(true)
      await flushPendingSave()
      await createCheckpoint(token, noteId)
    } finally {
      setSavingCheckpoint(false)
    }
  }

  const handleRestored = useCallback(async () => {
    setShowVersionHistory(false)
    await fetchNote()
    setRefreshKey((k) => k + 1)
  }, [fetchNote])

  // ─── Loading / error states ────────────────────────────────────────────────

  if (loadingNote) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-[#f5f8ff]" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color="#2f64f6" />
        <Text className="text-[15px] text-[#5f7291]">Loading note…</Text>
      </View>
    )
  }

  if (fetchError || !note) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-[#f5f8ff]" style={{ paddingTop: insets.top }}>
        <FileText size={40} color="#94a3b8" strokeWidth={1.3} />
        <Text className="text-[15px] text-[#5f7291]">{fetchError ?? 'Note not found'}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Notes', undefined)}>
          <Text className="text-sm font-semibold text-[#2f64f6]">← Back to notes</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>

      <View style={{ paddingTop: insets.top }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View className="flex-row items-center px-[14px] py-[10px] border-b border-[#f0f4fa] gap-2 bg-white">
        <TouchableOpacity
          className="p-1"
          onPress={async () => {
            await flushPendingSave()
            navigation.navigate('Notes', undefined)
          }}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#101d36" />
        </TouchableOpacity>

        <View className="flex-1 overflow-hidden">
          {editingTitle ? (
            <TextInput
              ref={titleInputRef}
              className="text-base font-semibold text-[#101d36] p-0 border-b-2 border-[#2f64f6]"
              value={titleDraft}
              onChangeText={setTitleDraft}
              onBlur={commitTitle}
              onSubmitEditing={commitTitle}
              maxLength={120}
              returnKeyType="done"
            />
          ) : (
            <Pressable onPress={startEditTitle}>
              <Text
                className={`text-base font-semibold text-[#101d36] ${isOwner ? 'underline decoration-dotted decoration-[#dce6f3]' : ''}`}
                numberOfLines={1}
              >
                {note.title || 'Untitled document'}
              </Text>
            </Pressable>
          )}
          <View className={`self-start mt-0.5 px-[6px] py-px rounded ${noteRoleBg}`}>
            <Text className={`text-[10px] font-semibold ${noteRoleColor}`}>
              {noteRoleLabel}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-1">
          <PresenceIndicator onlineCount={onlineCount} othersOnline={othersOnline} />
          <SaveIndicator status={saveStatus} />

          {canEdit && (
            <TouchableOpacity
              className="p-[7px] rounded-lg"
              onPress={handleSaveCheckpoint}
              disabled={savingCheckpoint}
              hitSlop={6}
              activeOpacity={0.7}
            >
              {savingCheckpoint ? (
                <ActivityIndicator size="small" color="#2f64f6" />
              ) : (
                <BookmarkPlus size={20} color="#2f64f6" />
              )}
            </TouchableOpacity>
          )}

          {isOwner && (
            <TouchableOpacity
              className={`p-[7px] rounded-lg ${isArchived ? 'bg-[#fef3c7]' : ''}`}
              onPress={handleToggleArchive}
              disabled={archiving}
              hitSlop={6}
              activeOpacity={0.7}
            >
              {archiving
                ? <ActivityIndicator size="small" color="#f59e0b" />
                : isArchived
                  ? <ArchiveRestore size={20} color="#f59e0b" />
                  : <Archive size={20} color="#5f7291" />
              }
            </TouchableOpacity>
          )}

          {isOwner && (
            <TouchableOpacity
              className={`p-[7px] rounded-lg ${showShare ? 'bg-[#2f64f6]' : ''}`}
              onPress={() => { setShowShare(true); setShowVersionHistory(false); setShowAIInsights(false) }}
              hitSlop={6}
              activeOpacity={0.7}
            >
              <Share2 size={20} color={showShare ? '#fff' : '#2f64f6'} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className={`p-[7px] rounded-lg ${showVersionHistory ? 'bg-[#2f64f6]' : ''}`}
            onPress={() => { setShowVersionHistory(true); setShowShare(false); setShowAIInsights(false) }}
            hitSlop={6}
            activeOpacity={0.7}
          >
            <History size={20} color={showVersionHistory ? '#fff' : '#2f64f6'} />
          </TouchableOpacity>

          <TouchableOpacity
            className={`p-[7px] rounded-lg ${showAIInsights ? 'bg-[#f59e0b]' : ''}`}
            onPress={() => { setShowAIInsights(true); setShowVersionHistory(false); setShowShare(false) }}
            hitSlop={6}
            activeOpacity={0.7}
          >
            <Sparkles size={20} color={showAIInsights ? '#fff' : '#f59e0b'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Archived banner ───────────────────────────────────────────────── */}
      {isArchived && (
        <View className="flex-row items-center gap-2 px-4 py-2 bg-[#fef3c7] border-b border-[#fde68a]">
          <Archive size={13} color="#f59e0b" />
          <Text className="flex-1 text-xs text-[#92400e] font-medium">
            This note is archived. Unarchive it to enable editing.
          </Text>
          {isOwner && (
            <TouchableOpacity onPress={handleToggleArchive} activeOpacity={0.7}>
              <Text className="text-xs font-bold text-[#f59e0b]">Unarchive</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      </View>

      {/* NoteEditorPane mounts only after note is loaded, with real content
          already in hand. key forces full remount on version restore. */}
      <NoteEditorPane
        key={`${noteId}-${refreshKey}`}
        ref={editorPaneRef}
        noteId={noteId}
        token={token!}
        initialHtml={initialHtml}
        isContentEmpty={isNoteContentEmpty(note.content)}
        canEdit={canEdit}
        isArchived={isArchived}
        bottomInset={insets.bottom}
        onSaveStatusChange={setSaveStatus}
        onContentChange={setLiveHtmlContent}
      />

      {/* ── Bottom sheet panels ──────────────────────────────────────────── */}
      <MobileVersionHistoryPanel
        noteId={noteId}
        token={token!}
        canRestore={canEdit}
        visible={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        onRestored={handleRestored}
      />

      {token && (
        <MobileSharePanel
          noteId={noteId}
          token={token}
          isOwner={isOwner}
          visible={showShare}
          onClose={() => setShowShare(false)}
        />
      )}

      {token && (
        <MobileAIInsightsPanel
          token={token}
          threads={relatedThreads}
          isLoading={threadsLoading}
          hasRequested={threadsRequested}
          canRequestSuggestions={canRequestSuggestions}
          cooldownRemainingMs={cooldownRemainingMs}
          onRequestSuggestions={requestSuggestions}
          visible={showAIInsights}
          onClose={() => setShowAIInsights(false)}
        />
      )}
    </View>
  )
}

// ─── Presence indicator ──────────────────────────────────────────────────────

function PresenceIndicator({ onlineCount, othersOnline }: { onlineCount: number; othersOnline: number }) {
  if (onlineCount === 0) return null
  const isAlone = othersOnline === 0
  return (
    <View className="flex-row items-center gap-1 px-2 py-1 rounded-md bg-[#f0f4fa] border border-[#dce6f3]">
      <View className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: isAlone ? '#94a3b8' : '#22c55e' }} />
      <Text className="text-[10px] font-medium text-[#5f7291]">
        {isAlone ? 'Only you' : `${othersOnline} other${othersOnline === 1 ? '' : 's'} online`}
      </Text>
    </View>
  )
}

// ─── Save indicator ───────────────────────────────────────────────────────────

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  const colorMap: Record<Exclude<SaveStatus, 'idle'>, { text: string; border: string; bg: string; icon: string }> = {
    saving: { text: 'text-[#f4a300]', border: 'border-[#f4a30033]', bg: 'bg-[#f4a30018]', icon: '#f4a300' },
    saved:  { text: 'text-[#1f8a4c]', border: 'border-[#1f8a4c33]', bg: 'bg-[#1f8a4c18]', icon: '#1f8a4c' },
    error:  { text: 'text-[#c53b4f]', border: 'border-[#c53b4f33]', bg: 'bg-[#c53b4f18]', icon: '#c53b4f' },
  }
  const c = colorMap[status]
  return (
    <View className={`flex-row items-center gap-1 px-2 py-1 rounded-md border ${c.border} ${c.bg}`}>
      {status === 'saving' && <ActivityIndicator size={10} color={c.icon} />}
      {status === 'saved' && <CheckCircle2 size={11} color={c.icon} />}
      {status === 'error' && <AlertCircle size={11} color={c.icon} />}
      <Text className={`text-[11px] font-semibold ${c.text}`}>
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Failed'}
      </Text>
    </View>
  )
}
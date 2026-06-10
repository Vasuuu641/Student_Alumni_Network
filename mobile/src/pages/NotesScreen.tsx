// screens/NoteScreen.tsx
// Mobile equivalent of src/pages/NotePage.tsx
//
// Dependencies:
//   npx expo install @10play/tentap-editor react-native-webview
//   npx expo install react-native-safe-area-context
//   yarn add lucide-react-native
//   @react-navigation/native + @react-navigation/native-stack
//
// Note: @10play/tentap-editor requires an Expo Dev Client build for full
// functionality. Basic usage (no custom CSS/fonts) works in Expo Go.
//
// Collaborative cursors are intentionally omitted — TenTap's real-time
// collab is a paid Pro feature. Autosave + version history covers mobile.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  InteractionManager,
  KeyboardAvoidingView,
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
  RichText,
  Toolbar,
  useEditorBridge,
  useEditorContent,
  TenTapStartKit,
} from '@10play/tentap-editor'
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<RootStackParamList>
type NoteRoute = RouteProp<RootStackParamList, 'NoteScreen'>

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface NoteData {
  id: string
  title: string
  content: any
  ownerId: string
  status: 'ACTIVE' | 'ARCHIVED'
  role?: string    // "OWNER" | "EDITOR" | "VIEWER" — returned by the API
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

// ─── Outer shell: auth + fetch ─────────────────────────────────────────────────
// Handles auth resolution and note fetching. Only renders the editor once the
// note data is ready so we can pass initialContent to useEditorBridge — this
// is the only reliable way to seed content without fighting the WebView lifecycle.

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

  // screenReady becomes true once the React Navigation transition animation
  // has fully settled. We defer NoteEditor (and its inner WebView) until this
  // point — WebViews inside navigated screens won't paint their content until
  // the native layer is committed, which only happens after the animation ends.
  const [screenReady, setScreenReady] = useState(false)

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setScreenReady(true)
    })
    return () => task.cancel()
  }, [])

  const [note, setNote] = useState<NoteData | null>(null)
  const [loadingNote, setLoadingNote] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!authReady) return
    if (!token) navigation.replace('Login', undefined)
    else if (!canAccessNotes) navigation.replace('Notes', undefined)
  }, [authReady, token, canAccessNotes, navigation])

  const fetchNote = useCallback(async (withToken?: string) => {
    const t = withToken ?? token
    if (!authReady || !noteId || !t) {
      if (authReady) setLoadingNote(false)
      return
    }
    try {
      setFetchError(null)
      const fetchedNote = await getNote(t, noteId)
      setNote(fetchedNote)
    } catch {
      setFetchError('Failed to load note')
    } finally {
      setLoadingNote(false)
    }
  }, [authReady, noteId, token])

  useEffect(() => { fetchNote() }, [fetchNote])

  // ─── Loading / error states ──────────────────────────────────────────────────

  if (loadingNote || !screenReady) {
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

  // Note is ready — hand off to the editor. It only mounts here, so initialContent
  // is set once and never needs to be injected post-mount via setContent.
  return (
    <NoteEditor
      key={note.id}           // remount on version restore
      note={note}
      noteId={noteId}
      token={token!}
      currentUserId={currentUserId}
      canEdit={authReady && canAccessNotes && role !== 'ALUMNI'}
      insets={insets}
      navigation={navigation}
      onNoteChange={setNote}
      onRefresh={() => fetchNote()}
    />
  )
}

// ─── Inner editor ─────────────────────────────────────────────────────────────
// Receives note data as props so it can pass initialContent to useEditorBridge.
// This is the only reliable approach — once the WebView mounts with the right
// HTML baked in, no post-mount setContent injection is needed.

interface NoteEditorProps {
  note: NoteData
  noteId: string
  token: string
  currentUserId: string | null
  canEdit: boolean
  insets: { top: number; bottom: number }
  navigation: Nav
  onNoteChange: (updater: (prev: NoteData | null) => NoteData | null) => void
  onRefresh: () => Promise<void>
}

function NoteEditor({
  note,
  noteId,
  token,
  currentUserId,
  canEdit,
  insets,
  navigation,
  onNoteChange,
  onRefresh,
}: NoteEditorProps) {
  const isOwner = note.ownerId === currentUserId
  const isArchived = note.status === 'ARCHIVED'

  // Compute the initial HTML seed once — passed straight to useEditorBridge so
  // TenTap bakes it into the WebView's initial HTML. No setContent needed.
  const initialHtml = tiptapJsonToHtml(note.content)

  const isContentEmpty = !note.content ||
    (typeof note.content === 'object' &&
      Array.isArray(note.content?.content) &&
      note.content.content.length === 0) ||
    (typeof note.content === 'string' && note.content.trim() === '') ||
    initialHtml.replace(/<[^>]*>/g, '').trim() === ''

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [savingCheckpoint, setSavingCheckpoint] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [isEmpty, setIsEmpty] = useState(isContentEmpty)

  const [titleDraft, setTitleDraft] = useState(note.title)
  const [editingTitle, setEditingTitle] = useState(false)
  const titleInputRef = useRef<TextInput>(null)

  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showAIInsights, setShowAIInsights] = useState(false)

  const lastSavedRef = useRef<string>(initialHtml)
  const inFlightRef = useRef(false)
  const hasPendingRef = useRef(false)
  const pendingContentRef = useRef<string>('')
  const autosaveArmedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Editor ──────────────────────────────────────────────────────────────────
  // initialContent is set here so the WebView bakes it into its initial HTML.
  // editable starts false so the toolbar doesn't flash before content appears.
  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    editable: false,
    initialContent: initialHtml,
    bridgeExtensions: TenTapStartKit,
  })

  const htmlContent = useEditorContent(editor, {
    type: 'html',
    debounceInterval: 500,
  })

  // Once the WebView has confirmed content (htmlContent first fires), unlock editing.
  // We use a ref to only do this once per mount.
  const editableArmedRef = useRef(false)
  useEffect(() => {
    if (editableArmedRef.current) return
    // htmlContent is undefined until the WebView fires its first update.
    // When it becomes a string (even empty), the bridge is alive.
    if (htmlContent === undefined) return
    editableArmedRef.current = true
    if (canEdit) {
      editor.setEditable(true)
      autosaveArmedRef.current = true
    }
  }, [htmlContent, canEdit, editor])

  // ─── Presence ──────────────────────────────────────────────────────────────
  const { onlineCount, othersOnline } = useNotePresence({
    noteId,
    userId: currentUserId,
    enabled: true,
  })

  // ─── AI Insights ───────────────────────────────────────────────────────────
  const plainTextContent = htmlContent
    ? htmlContent.replace(/<[^>]*>/g, '').trim()
    : ''

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
  })

  // ─── Derive display role label ─────────────────────────────────────────────
  const noteRoleLabel: string = (() => {
    const r = note?.role?.toUpperCase()
    if (r === 'OWNER' || isOwner) return 'Owner'
    if (r === 'EDITOR' || canEdit) return 'Editor'
    return 'Viewer'
  })()

  const noteRoleBg = (isOwner || note?.role?.toUpperCase() === 'OWNER')
    ? 'bg-[#eaf1ff]' : 'bg-[#f0f4fa]'
  const noteRoleColor = (isOwner || note?.role?.toUpperCase() === 'OWNER')
    ? 'text-[#2f64f6]' : canEdit ? 'text-[#5f7291]' : 'text-[#94a3b8]'

  // ─── Autosave ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!autosaveArmedRef.current) return
    if (!htmlContent) return
    if (isEmpty && htmlContent.replace(/<[^>]*>/g, '').trim().length > 0) {
      setIsEmpty(false)
    }
    void persistContent(htmlContent)
  }, [htmlContent, isEmpty]) // eslint-disable-line react-hooks/exhaustive-deps

  const persistContent = useCallback(async (content: string) => {
    if (!canEdit || !token || !noteId) return
    if (!autosaveArmedRef.current) return
    if (content === lastSavedRef.current) return
    if (inFlightRef.current) {
      hasPendingRef.current = true
      pendingContentRef.current = content
      return
    }
    inFlightRef.current = true
    setSaveStatus('saving')
    try {
      await updateNote(token, noteId, { content })
      lastSavedRef.current = content
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1200)
    } catch {
      setSaveStatus('error')
    } finally {
      inFlightRef.current = false
      if (hasPendingRef.current) {
        hasPendingRef.current = false
        const pending = pendingContentRef.current
        pendingContentRef.current = ''
        await persistContent(pending)
      }
    }
  }, [canEdit, token, noteId])

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (autosaveArmedRef.current && token && noteId && canEdit) {
      try {
        const latestHtml = await editor.getHTML()
        await persistContent(latestHtml)
      } catch {
        // ignore — best-effort flush
      }
    }
  }, [editor, token, noteId, canEdit, persistContent])

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

  // ─── Actions ──────────────────────────────────────────────────────────────

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
      onNoteChange((prev) => prev ? { ...prev, title: trimmed } : prev)
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
      onNoteChange((prev) => prev ? { ...prev, status: nextStatus } : prev)
    } catch {
      // silently fail — user can retry
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
    // Reset autosave arm, close panel, then remount via key change (handled by parent)
    autosaveArmedRef.current = false
    editableArmedRef.current = false
    setShowVersionHistory(false)
    await onRefresh()
  }, [onRefresh])

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View className="flex-row items-center px-[14px] py-[10px] border-b border-[#f0f4fa] gap-2 bg-white">
        {/* Back */}
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

        {/* Title + role badge */}
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
          {/* Role badge — mirrors web "Owner" / "Editor" / "Viewer" label */}
          <View className={`self-start mt-0.5 px-[6px] py-px rounded ${noteRoleBg}`}>
            <Text className={`text-[10px] font-semibold ${noteRoleColor}`}>
              {noteRoleLabel}
            </Text>
          </View>
        </View>

        {/* Right actions */}
        <View className="flex-row items-center gap-1">
          {/* Presence indicator — mirrors web "● N online" */}
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

      {/* ── Editor ─────────────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1 }}>
          <RichText editor={editor} style={{ flex: 1 }} />
          {/* Empty state — shown for new/blank notes until the user starts typing */}
          {isEmpty && canEdit && !isArchived && (
            <View
              className="absolute left-0 right-0 top-0"
              style={{ paddingTop: 16, paddingHorizontal: 24 }}
              pointerEvents="none"
            >
              <Text className="text-[15px] text-[#c8d5e8]">
                Start writing your note…
              </Text>
            </View>
          )}
        </View>

        {canEdit && (
          <View
            className="bg-white border-t border-[#f0f4fa]"
            style={{ paddingBottom: insets.bottom }}
          >
            <Toolbar editor={editor} />
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── Bottom sheet panels ─────────────────────────────────────────────── */}
      <MobileVersionHistoryPanel
        noteId={noteId}
        token={token}
        canRestore={canEdit}
        visible={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        onRestored={handleRestored}
      />

      <MobileSharePanel
        noteId={noteId}
        token={token}
        isOwner={isOwner}
        visible={showShare}
        onClose={() => setShowShare(false)}
      />

      <MobileAIInsightsPanel
        token={token}
        threads={relatedThreads}
        isLoading={threadsLoading}
        hasRequested={threadsRequested}
        canRequestSuggestions={canRequestSuggestions}
        cooldownRemainingMs={cooldownRemainingMs}
        onRequestSuggestions={() => void requestSuggestions()}
        visible={showAIInsights}
        onClose={() => setShowAIInsights(false)}
      />
    </View>
  )
}

// ─── Presence indicator ──────────────────────────────────────────────────────

interface PresenceIndicatorProps {
  onlineCount: number
  othersOnline: number
}

function PresenceIndicator({ onlineCount, othersOnline }: PresenceIndicatorProps) {
  // Don't show anything until at least one person is online (self)
  if (onlineCount === 0) return null

  const isAlone = othersOnline === 0
  const dotColor = isAlone ? '#94a3b8' : '#22c55e'
  const label = isAlone
    ? 'Only you'
    : `${othersOnline} other${othersOnline === 1 ? '' : 's'} online`

  return (
    <View className="flex-row items-center gap-1 px-2 py-1 rounded-md bg-[#f0f4fa] border border-[#dce6f3]">
      {/* Pulsing dot */}
      <View
        className="w-[7px] h-[7px] rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      <Text className="text-[10px] font-medium text-[#5f7291]">{label}</Text>
    </View>
  )
}

// ─── Save indicator ───────────────────────────────────────────────────────────

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null

  const colorMap = {
    saving: { text: 'text-[#f4a300]', border: 'border-[#f4a30033]', bg: 'bg-[#f4a30018]', icon: '#f4a300' },
    saved: { text: 'text-[#1f8a4c]', border: 'border-[#1f8a4c33]', bg: 'bg-[#1f8a4c18]', icon: '#1f8a4c' },
    error: { text: 'text-[#c53b4f]', border: 'border-[#c53b4f33]', bg: 'bg-[#c53b4f18]', icon: '#c53b4f' },
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
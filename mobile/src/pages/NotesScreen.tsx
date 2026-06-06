import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
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
  AlertCircle,
  ArrowLeft,
  BookmarkPlus,
  CheckCircle2,
  FileText,
  History,
  Lightbulb,
} from 'lucide-react-native'

import { getNote, updateNote, createCheckpoint } from '../api/notes.api'
import { getAccessToken } from '../lib/auth-storage'
import { getRoleFromAccessToken } from '../lib/jwt'
import { MobileVersionHistoryPanel } from '../components/notes/MobileVersionHistoryPanel'
import { MobileSharePanel } from '../components/notes/MobileSharePanel'
import { MobileAIInsightsPanel } from '../components/notes/MobileInsightsPanel'
import { useRelatedThreads } from '../hooks/UseRelatedThreads'

// ─── Types ────────────────────────────────────────────────────────────────────

type RootStackParamList = {
  NotesList: undefined
  Note: { noteId: string }
  Login: undefined
}

type Nav = NativeStackNavigationProp<RootStackParamList>
type NoteRoute = RouteProp<RootStackParamList, 'Note'>
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface NoteData {
  id: string
  title: string
  content: any
  ownerId: string
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
  if (typeof json === 'object' && json.type === 'doc') return jsonNodeToHtml(json)
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
    return `<h${level}>${(node.content ?? []).map(jsonNodeToHtml).join('')}</h${level}>`
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export function NoteScreen() {

  const navigation = useNavigation<Nav>()
  const route = useRoute<NoteRoute>()
  const insets = useSafeAreaInsets()
  const { noteId } = route.params
 
  const [token, setToken] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
 
  useEffect(() => {
    getAccessToken().then((t) => {
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
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showAIInsights, setShowAIInsights] = useState(false)

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [savingCheckpoint, setSavingCheckpoint] = useState(false)

  const [titleDraft, setTitleDraft] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const titleInputRef = useRef<TextInput>(null)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>('')
  const inFlightRef = useRef(false)
  const hasPendingRef = useRef(false)
  const pendingContentRef = useRef<string>('')
  const autosaveArmedRef = useRef(false)
  const hasSetInitialContentRef = useRef(false)

  const canEdit = canAccessNotes && role !== 'ALUMNI'
  const isOwner = note ? note.ownerId === currentUserId : false

  // ─── TenTap editor ──────────────────────────────────────────────────────────

  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    editable: false,
    bridgeExtensions: TenTapStartKit,
  })

  const htmlContent = useEditorContent(editor, {
    type: 'html',
    debounceInterval: 500,
  })

  // ─── AI related threads ──────────────────────────────────────────────────────

  const {
    threads: relatedThreads,
    isLoading: aiLoading,
    hasRequested: aiHasRequested,
    canRequestSuggestions,
    cooldownRemainingMs,
    requestSuggestions,
  } = useRelatedThreads({
    noteId,
    token,
    noteContent: htmlContent ?? '',
    title: note?.title ?? '',
    contentJson: note?.content ?? null,
    enabled: showAIInsights,
  })

  // ─── Auth redirect ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) navigation.replace('Login')
    if (!canAccessNotes) navigation.replace('NotesList' as any)
  }, [token, canAccessNotes, navigation])

  // ─── Fetch note ──────────────────────────────────────────────────────────────

    const fetchNote = useCallback(async () => {
    if (!authReady || !noteId || !token) return
    try {
      setFetchError(null)
      const fetchedNote = await getNote(token, noteId)
      setNote(fetchedNote)
      setTitleDraft(fetchedNote.title)
      lastSavedRef.current = JSON.stringify(fetchedNote.content ?? null)
    } catch {
      setFetchError('Failed to load note')
    } finally {
      setLoadingNote(false)
    }
  }, [authReady, noteId, token])
 
  useEffect(() => { fetchNote() }, [fetchNote])


  // ─── Seed editor once note loads ─────────────────────────────────────────────

  useEffect(() => {
    if (!note || hasSetInitialContentRef.current) return
    editor.setContent(tiptapJsonToHtml(note.content))
    hasSetInitialContentRef.current = true
    setTimeout(() => {
      editor.setEditable(canEdit)
      autosaveArmedRef.current = true
    }, 600)
  }, [note, editor, canEdit])

  // ─── Autosave on content change ──────────────────────────────────────────────

  useEffect(() => {
    if (!autosaveArmedRef.current || !htmlContent) return
    void persistContent(htmlContent)
  }, [htmlContent]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Persist ─────────────────────────────────────────────────────────────────

  const persistContent = useCallback(async (content: string) => {
    if (!canEdit || !token || !noteId || !autosaveArmedRef.current) return
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
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    if (autosaveArmedRef.current && token && noteId && canEdit) {
      try {
        const latestHtml = await editor.getHTML()
        await persistContent(latestHtml)
      } catch { /* best-effort */ }
    }
  }, [editor, token, noteId, canEdit, persistContent])

  // ─── AppState flush on background ────────────────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') void flushPendingSave()
    })
    return () => sub.remove()
  }, [flushPendingSave])

  useEffect(() => () => { void flushPendingSave() }, [flushPendingSave])

  // ─── Title editing ────────────────────────────────────────────────────────────

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

  // ─── Checkpoint ───────────────────────────────────────────────────────────────

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

  // ─── Version restore ──────────────────────────────────────────────────────────

  const handleRestored = useCallback(async () => {
    hasSetInitialContentRef.current = false
    autosaveArmedRef.current = false
    setShowVersionHistory(false)
    await fetchNote()
  }, [fetchNote])

  // ─── Loading / error states ───────────────────────────────────────────────────

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
        <TouchableOpacity onPress={() => navigation.navigate('NotesList')}>
          <Text className="text-[14px] font-semibold text-[#2f64f6]">← Back to notes</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>

      {/* Header */}
      <View className="flex-row items-center px-3.5 py-2.5 border-b border-[#f0f4fa] gap-2">
        {/* Back */}
        <TouchableOpacity
          className="p-1"
          onPress={async () => { await flushPendingSave(); navigation.navigate('NotesList') }}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#101d36" />
        </TouchableOpacity>

        {/* Title */}
        <View className="flex-1 overflow-hidden">
          {editingTitle ? (
            <TextInput
              ref={titleInputRef}
              className="text-[16px] font-semibold text-[#101d36] p-0 border-b-[1.5px] border-[#2f64f6]"
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
                className={`text-[16px] font-semibold text-[#101d36] ${isOwner ? 'underline decoration-dotted decoration-[#dce6f3]' : ''}`}
                numberOfLines={1}
              >
                {note.title || 'Untitled document'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Right actions */}
        <View className="flex-row items-center gap-1">
          <SaveIndicator status={saveStatus} />

          {canEdit && (
            <TouchableOpacity
              className="p-[7px] rounded-lg"
              onPress={handleSaveCheckpoint}
              disabled={savingCheckpoint}
              hitSlop={6}
              activeOpacity={0.7}
            >
              {savingCheckpoint
                ? <ActivityIndicator size="small" color="#2f64f6" />
                : <BookmarkPlus size={20} color="#2f64f6" />
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
              {/* Using BookmarkPlus as placeholder — swap for Share2 if available in your lucide version */}
              <Text className={`text-[13px] font-semibold ${showShare ? 'text-white' : 'text-[#2f64f6]'}`}>Share</Text>
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
            onPress={() => { setShowAIInsights(true); setShowShare(false); setShowVersionHistory(false) }}
            hitSlop={6}
            activeOpacity={0.7}
          >
            <Lightbulb size={20} color={showAIInsights ? '#fff' : '#f59e0b'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Editor */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <RichText editor={editor} className="flex-1" />
        {canEdit && (
          <View className="bg-white border-t border-[#f0f4fa]" style={{ paddingBottom: insets.bottom }}>
            <Toolbar editor={editor} />
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Bottom sheet panels */}
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
          isLoading={aiLoading}
          hasRequested={aiHasRequested}
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

// ─── Save indicator ───────────────────────────────────────────────────────────

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null

  const colorClass = status === 'saving'
    ? 'border-[#f4a300]/20 bg-[#f4a300]/10'
    : status === 'saved'
    ? 'border-[#1f8a4c]/20 bg-[#1f8a4c]/10'
    : 'border-[#c53b4f]/20 bg-[#c53b4f]/10'

  const textColor = status === 'saving' ? '#f4a300' : status === 'saved' ? '#1f8a4c' : '#c53b4f'
  const label = status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Failed'

  return (
    <View className={`flex-row items-center gap-1 px-2 py-1 rounded-lg border ${colorClass}`}>
      {status === 'saving' && <ActivityIndicator size={10} color={textColor} />}
      {status === 'saved' && <CheckCircle2 size={11} color={textColor} />}
      {status === 'error' && <AlertCircle size={11} color={textColor} />}
      <Text className="text-[11px] font-semibold" style={{ color: textColor }}>{label}</Text>
    </View>
  )
}
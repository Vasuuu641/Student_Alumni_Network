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
  BookmarkPlus,
  CheckCircle2,
  AlertCircle,
  FileText,
  History,
  Share2,
} from 'lucide-react-native'

import { getNote, updateNote, createCheckpoint } from '../api/notes.api'
import { getAccessToken, getRoleFromAccessToken } from '../lib/auth'
import { MobileVersionHistoryPanel } from '../components/notes/MobileVersionHistoryPanel'
import { MobileSharePanel } from '../components/notes/MobileSharePanel'

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

// ─── Screen ───────────────────────────────────────────────────────────────────

export function NoteScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<NoteRoute>()
  const insets = useSafeAreaInsets()
  const { noteId } = route.params

  const token = getAccessToken()
  const role = token ? getRoleFromAccessToken(token) : null
  const currentUserId = token ? decodeUserId(token) : null
  const canAccessNotes = role !== 'ALUMNI'

  const [note, setNote] = useState<NoteData | null>(null)
  const [loadingNote, setLoadingNote] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showShare, setShowShare] = useState(false)

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

  const canEdit = canAccessNotes && role !== 'ALUMNI'
  const isOwner = note ? note.ownerId === currentUserId : false

  useEffect(() => {
    if (!token) navigation.replace('Login')
    if (!canAccessNotes) navigation.replace('NotesList' as any)
  }, [token, canAccessNotes, navigation])

  const fetchNote = useCallback(async () => {
    if (!noteId || !token) return
    try {
      setFetchError(null)
      const { note } = await getNote(token, noteId)
      setNote(note)
      setTitleDraft(note.title)
      lastSavedRef.current = JSON.stringify(note.content ?? null)
    } catch {
      setFetchError('Failed to load note')
    } finally {
      setLoadingNote(false)
    }
  }, [noteId, token])

  useEffect(() => { fetchNote() }, [fetchNote])

  useEffect(() => {
    if (!note || hasSetInitialContentRef.current) return
    const htmlSeed = tiptapJsonToHtml(note.content)
    editor.setContent(htmlSeed)
    hasSetInitialContentRef.current = true
    setTimeout(() => {
      editor.setEditable(canEdit)
      autosaveArmedRef.current = true
    }, 600)
  }, [note, editor, canEdit])

  useEffect(() => {
    if (!autosaveArmedRef.current) return
    if (!htmlContent) return
    void persistContent(htmlContent)
  }, [htmlContent]) // eslint-disable-line react-hooks/exhaustive-deps

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
          <Text className="text-sm font-semibold text-[#2f64f6]">← Back to notes</Text>
        </TouchableOpacity>
      </View>
    )
  }

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
            navigation.navigate('NotesList')
          }}
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
              {savingCheckpoint ? (
                <ActivityIndicator size="small" color="#2f64f6" />
              ) : (
                <BookmarkPlus size={20} color="#2f64f6" />
              )}
            </TouchableOpacity>
          )}

          {isOwner && (
            <TouchableOpacity
              className={`p-[7px] rounded-lg ${showShare ? 'bg-[#2f64f6]' : ''}`}
              onPress={() => { setShowShare(true); setShowVersionHistory(false) }}
              hitSlop={6}
              activeOpacity={0.7}
            >
              <Share2 size={20} color={showShare ? '#fff' : '#2f64f6'} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className={`p-[7px] rounded-lg ${showVersionHistory ? 'bg-[#2f64f6]' : ''}`}
            onPress={() => { setShowVersionHistory(true); setShowShare(false) }}
            hitSlop={6}
            activeOpacity={0.7}
          >
            <History size={20} color={showVersionHistory ? '#fff' : '#2f64f6'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Editor ─────────────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <RichText editor={editor} style={{ flex: 1 }} />

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
    </View>
  )
}

// ─── Save indicator ───────────────────────────────────────────────────────────

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null

  const colorMap = {
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
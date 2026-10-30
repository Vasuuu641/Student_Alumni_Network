// screens/NoteScreen.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  RichText,
  useEditorBridge,
  TenTapStartKit,
  ImageBridge,
  HistoryBridge,
} from '@10play/tentap-editor';
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
} from 'lucide-react-native';

import { getNote, updateNote, createCheckpoint } from '../api/notes.api';
import { getValidAccessToken } from '../lib/auth-session';
import { getRoleFromAccessToken } from '../lib/jwt';
import { socket } from '../lib/socket';
import { stringToColor } from '../lib/utils';
import type { RootStackParamList } from '../navigation/root-stack';
import { MobileVersionHistoryPanel } from '../components/notes/MobileVersionHistoryPanel';
import { MobileEditorToolbar } from '../components/notes/MobileEditorToolbar';
import { useRelatedThreads } from '../hooks/UseRelatedThreads';
import { MobileAIInsightsPanel } from '../components/notes/MobileInsightsPanel';
import { MobileSharePanel } from '../components/notes/MobileSharePanel';
import { useTheme } from '../theme/theme';
import { editorHtml } from '../editor/editorHtml';
import { CollabNativeBridge, collabListeners } from '../editor/CollabNativeBridge';
import { useNoteRoom } from '../hooks/UseNoteRoom';
import { useCollabRelay } from '../hooks/UseCollabRelay';

// ─── Bridges ───────────────────────────────────────────────────────────────
const baseBridges = (TenTapStartKit as any[]).filter(
  (b) => b !== HistoryBridge && b.name !== 'textStyle' && b.name !== 'listItem'
);
const NOTE_BRIDGES = [
  ...baseBridges,
  ...(baseBridges.includes(ImageBridge) ? [] : [ImageBridge]),
  CollabNativeBridge,
];

type Nav = NativeStackNavigationProp<RootStackParamList>;
type NoteRoute = RouteProp<RootStackParamList, 'NoteScreen'>;
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface NoteData {
  id: string;
  title: string;
  content: any;
  ownerId: string;
  status: 'ACTIVE' | 'ARCHIVED';
  updatedAt?: string;
  createdAt?: string;
}

function hasContent(n: any): boolean {
  if (!n) return false;
  if (typeof n === 'string') return /<img/i.test(n) || n.replace(/<[^>]*>/g, '').trim().length > 0;
  if (n.type === 'text') return !!n.text;
  if (n.type === 'image' || n.type === 'horizontalRule') return true;
  return (n.content ?? []).some(hasContent);
}

function decodeUserId(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.userId ?? null;
  } catch {
    return null;
  }
}

function jsonToPlainText(n: any): string {
  if (!n) return '';
  if (typeof n === 'string') return n.replace(/<[^>]*>/g, ' ').trim();
  if (n.type === 'text') return n.text ?? '';
  const parts: string[] = (n.content ?? []).map(jsonToPlainText);
  const block = ['doc', 'bulletList', 'orderedList', 'blockquote', 'pageSection', 'listItem'];
  return parts.join(block.includes(n.type) ? '\n' : '');
}

export function NoteScreen() {
  const route = useRoute<NoteRoute>();
  const noteId: string = (route.params as any)?.noteId ?? '';
  return <NoteScreenInner key={noteId} noteId={noteId} />;
}

function NoteScreenInner({ noteId }: { noteId: string }) {
  const { tokens } = useTheme();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    getValidAccessToken().then((t) => {
      setToken(t);
      setRole(t ? String(getRoleFromAccessToken(t)) : null);
      setCurrentUserId(t ? decodeUserId(t) : null);
      setAuthReady(true);
    });
  }, []);

  const canAccessNotes = role !== 'ALUMNI';

  const [note, setNote] = useState<NoteData | null>(null);
  const [loadingNote, setLoadingNote] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savingCheckpoint, setSavingCheckpoint] = useState(false);

  const [titleDraft, setTitleDraft] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef<TextInput>(null);

  const lastSavedRef = useRef<string>('');
  const inFlightRef = useRef(false);
  const pendingRef = useRef<any>(null);
  const armedRef = useRef(false);
  const latestJsonRef = useRef<any>(null);
  const initSentRef = useRef(false);

  const [editorReady, setEditorReady] = useState(false);
  const [collabReady, setCollabReady] = useState(false);
  const [everJoined, setEverJoined] = useState(false);
  const [liveText, setLiveText] = useState<string | null>(null);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [webInfo, setWebInfo] = useState<any>(null);

  const editor = useEditorBridge({
    customSource: editorHtml,
    autofocus: false,
    avoidIosKeyboard: true,
    editable: false,
    initialContent: note?.content,
    bridgeExtensions: NOTE_BRIDGES,
  });
  const collab = editor as any;

  const room = useNoteRoom(noteId, authReady && !!token && canAccessNotes);

  const isArchived = note?.status === 'ARCHIVED';
  const canEdit = room.canEdit && !isArchived && !loadFailed;
  const isOwner =
    room.role === 'OWNER' || (!!note && !!currentUserId && note.ownerId === currentUserId);

  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;

  const userColor = stringToColor(currentUserId ?? noteId);

  useCollabRelay(editor, noteId, collabReady);

  const plainTextContent = useMemo(
    () => liveText ?? jsonToPlainText(note?.content).trim(),
    [liveText, note?.content],
  );
  const isEmpty = plainTextContent.length === 0;

  const goToNotes = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Notes', undefined);
  }, [navigation]);

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
    contentJson: (liveText !== null ? latestJsonRef.current?.json : null) ?? note?.content ?? null,
    enabled: showAIInsights,
  });

  const noteRoleLabel =
    room.role === 'OWNER' ? 'Owner'
    : room.role === 'EDITOR' ? 'Editor'
    : room.role === 'VIEWER' ? 'Viewer'
    : '…';
  const noteRoleBg = isOwner ? tokens.primarySoft : tokens.surfaceElevated;
  const noteRoleColor = isOwner ? tokens.primary : canEdit ? tokens.primaryStrong : tokens.muted;

  useEffect(() => {
    if (!authReady) return;
    if (!token) navigation.replace('Login', undefined);
    else if (!canAccessNotes) navigation.replace('Notes', undefined);
  }, [authReady, token, canAccessNotes, navigation]);

  const fetchNote = useCallback(async (): Promise<NoteData | null> => {
    if (!authReady || !noteId || !token) {
      if (authReady) setLoadingNote(false);
      return null;
    }
    try {
      setFetchError(null);
      const fetched = (await getNote(token, noteId)) as NoteData;
      setNote(fetched);
      setTitleDraft(fetched.title);
      lastSavedRef.current = JSON.stringify(fetched.content ?? null);
      return fetched;
    } catch {
      setFetchError('Failed to load note');
      return null;
    } finally {
      setLoadingNote(false);
    }
  }, [authReady, noteId, token]);

  useEffect(() => { fetchNote(); }, [fetchNote]);

  // Track editor readiness
  useEffect(() => {
    const state = editor.getEditorState() as any;
    if (state && state.isReady) {
      setEditorReady(true);
      return;
    }
    return editor._subscribeToEditorStateUpdate((updated: any) => {
      if (updated && updated.isReady) setEditorReady(true);
    });
  }, [editor]);

  // Robust Editability & Cursor Focus Synchronization
  useEffect(() => {
    if (!collabReady) return;
    try {
      editor.setEditable(canEdit);
      if (canEdit) {
        const timer = setTimeout(() => {
          try {
            (editor as any).focus?.();
          } catch (e) {
            console.warn('[WebView Focus Error]', e);
          }
        }, 350);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.warn('[setEditable Error]', e);
    }
  }, [collabReady, canEdit, editor]);

  useEffect(() => {
    if (initSentRef.current || !note) return;
    let done = false;
    const onAck = (type: string, msg: any) => {
      if (type !== 'inited' || msg?.noteId !== noteId || done) return;
      done = true;
      initSentRef.current = true;
      setCollabReady(true);
    };
    collabListeners.add(onAck);
    const send = () => {
      if (!done) collab.collabInit({ noteId, initialContent: note.content });
    };
    send();
    const timer = setInterval(send, 500);
    return () => {
      clearInterval(timer);
      collabListeners.delete(onAck);
    };
  }, [note, noteId]);

  useEffect(() => {
    if (!collabReady) return;
    const first = (room.currentUser?.displayName ?? '').trim().split(/\s+/)[0] || 'User';
    collab.collabRoom({
      status: room.status,
      canEdit,
      peerCount: room.peerCount,
      user: { name: first, color: userColor },
    });
  }, [collabReady, room.status, canEdit, room.peerCount, room.currentUser?.displayName]);

  useEffect(() => {
    if (room.status === 'joined') setEverJoined(true);
  }, [room.status]);

  const persistContent = useCallback(async (json: any, cleared = false) => {
    if (!canEditRef.current || !armedRef.current || !noteId) return;

    if (!hasContent(json)) {
      let prevHadContent = false;
      try { prevHadContent = hasContent(JSON.parse(lastSavedRef.current)); } catch {}
      if (prevHadContent && !cleared) return;
    }

    const serialized = JSON.stringify(json ?? null);
    if (serialized === lastSavedRef.current) return;
    if (inFlightRef.current) {
      pendingRef.current = { json, cleared };
      return;
    }
    inFlightRef.current = true;
    setSaveStatus('saving');
    try {
      const t = await getValidAccessToken();
      if (!t) throw new Error('no token');
      await updateNote(t, noteId, { content: json });
      lastSavedRef.current = serialized;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1200);
    } catch {
      setSaveStatus('error');
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current) {
        const next = pendingRef.current;
        pendingRef.current = null;
        void persistContent(next.json, next.cleared);
      }
    }
  }, [noteId]);

  useEffect(() => {
    const listener = (type: string, msg: any) => {
      if (msg?.noteId !== noteId) return;
      const payload = msg.data;
      if (type === 'armed') armedRef.current = true;
      else if (type === 'load-failed') { armedRef.current = false; setLoadFailed(true); }
      else if (type === 'history') setHistory((prev) =>
        prev.canUndo === !!payload?.canUndo && prev.canRedo === !!payload?.canRedo
          ? prev
          : { canUndo: !!payload?.canUndo, canRedo: !!payload?.canRedo });
      else if (type === 'content') {
        const contentData = payload as { json: any; cleared?: boolean };
        latestJsonRef.current = contentData;
        setLiveText(jsonToPlainText(contentData.json).trim());
        void persistContent(contentData.json, contentData.cleared ?? false);
      }
      else if (type === 'info') setWebInfo(payload);
      else if (type === 'error') console.warn('[WEBVIEW ERROR]', payload);
    };
    collabListeners.add(listener);
    return () => { collabListeners.delete(listener); };
  }, [persistContent, noteId]);

  const flushPendingSave = useCallback(async () => {
    if (!armedRef.current) return;
    collab.collabFlush();
    await new Promise((r) => setTimeout(r, 150));
    const latest = latestJsonRef.current;
    if (latest) await persistContent(latest.json, latest.cleared);
    for (let i = 0; i < 100 && (inFlightRef.current || pendingRef.current); i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
  }, [editor, persistContent]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'background' || s === 'inactive') void flushPendingSave();
      if (s === 'active' && !socket.connected) socket.connect();
    });
    return () => sub.remove();
  }, [flushPendingSave]);

  useEffect(() => {
    return () => { void flushPendingSave(); };
  }, [flushPendingSave]);

  function startEditTitle() {
    if (!isOwner) return;
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 30);
  }

  async function commitTitle() {
    setEditingTitle(false);
    const trimmed = titleDraft.trim() || 'Untitled document';
    if (trimmed === note?.title || !token) return;
    try {
      await updateNote(token, noteId, { title: trimmed });
      setNote((prev) => (prev ? { ...prev, title: trimmed } : prev));
    } catch {
      setTitleDraft(note?.title ?? '');
    }
  }

  const handleToggleArchive = async () => {
    if (!token || !note || !isOwner) return;
    const nextStatus = isArchived ? 'ACTIVE' : 'ARCHIVED';
    try {
      setArchiving(true);
      await updateNote(token, noteId, { status: nextStatus });
      setNote((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    } catch {
      // silently fail
    } finally {
      setArchiving(false);
    }
  };

  const handleSaveCheckpoint = async () => {
    if (!token) return;
    try {
      setSavingCheckpoint(true);
      await flushPendingSave();
      await createCheckpoint(token, noteId);
    } finally {
      setSavingCheckpoint(false);
    }
  };

  const handleRestored = useCallback(async () => {
    setShowVersionHistory(false);
    const fresh = await fetchNote();
    if (fresh) {
      setLiveText(null);
      latestJsonRef.current = null;
      lastSavedRef.current = JSON.stringify(fresh.content ?? null);
      collab.collabReplace(fresh.content);
    }
  }, [fetchNote, editor]);

  const isMidnight = tokens.name === 'midnight';

  if (loadingNote) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: tokens.background, paddingTop: insets.top }}>
        <ActivityIndicator size="large" color={tokens.primary} />
        <Text style={{ fontSize: 15, color: tokens.muted }}>Loading note…</Text>
      </View>
    );
  }

  if (fetchError || !note) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: tokens.background, paddingTop: insets.top }}>
        <FileText size={40} color={tokens.muted} strokeWidth={1.3} />
        <Text style={{ fontSize: 15, color: tokens.muted }}>{fetchError ?? 'Note not found'}</Text>
        <TouchableOpacity onPress={goToNotes}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.primary }}>← Back to notes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (room.status === 'denied') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: tokens.background, paddingTop: insets.top }}>
        <FileText size={40} color={tokens.muted} strokeWidth={1.3} />
        <Text style={{ fontSize: 15, color: tokens.muted }}>You don't have access to this note.</Text>
        <TouchableOpacity onPress={goToNotes}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.primary }}>← Back to notes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const onlineCount = room.status === 'joined' ? room.others.length + 1 : 0;
  const othersOnline = room.others.length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.surface }}
      behavior="padding"
      enabled={Platform.OS === 'ios'}
      keyboardVerticalOffset={0}
    >
      <StatusBar style={isMidnight ? 'light' : 'dark'} />

      <View style={{ paddingTop: insets.top, backgroundColor: tokens.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.border, gap: 8, backgroundColor: tokens.surface }}>
          <TouchableOpacity
            style={{ padding: 4 }}
            onPress={async () => {
              await flushPendingSave();
              goToNotes();
            }}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={tokens.text} />
          </TouchableOpacity>

          <View style={{ flex: 1, overflow: 'hidden' }}>
            {editingTitle ? (
              <TextInput
                ref={titleInputRef}
                style={{ fontSize: 16, fontWeight: '700', color: tokens.text, padding: 0, borderBottomWidth: 2, borderBottomColor: tokens.primary }}
                value={titleDraft}
                onChangeText={setTitleDraft}
                onBlur={commitTitle}
                onSubmitEditing={commitTitle}
                maxLength={120}
                returnKeyType="done"
              />
            ) : (
              <Pressable onPress={startEditTitle}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.text }} numberOfLines={1}>
                  {note.title || 'Untitled document'}
                </Text>
              </Pressable>
            )}
            <View style={{ alignSelf: 'flex-start', marginTop: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: noteRoleBg }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: noteRoleColor }}>{noteRoleLabel}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <PresenceIndicator onlineCount={onlineCount} othersOnline={othersOnline} tokens={tokens} />
            <SaveIndicator status={saveStatus} tokens={tokens} isMidnight={isMidnight} />

            {canEdit && (
              <TouchableOpacity
                style={{ padding: 6, borderRadius: 8 }}
                onPress={handleSaveCheckpoint}
                disabled={savingCheckpoint}
                hitSlop={6}
                activeOpacity={0.7}
              >
                {savingCheckpoint ? (
                  <ActivityIndicator size="small" color={tokens.primary} />
                ) : (
                  <BookmarkPlus size={20} color={tokens.primary} />
                )}
              </TouchableOpacity>
            )}

            {isOwner && (
              <TouchableOpacity
                style={{ padding: 6, borderRadius: 8, backgroundColor: isArchived ? tokens.accentSoft : 'transparent' }}
                onPress={handleToggleArchive}
                disabled={archiving}
                hitSlop={6}
                activeOpacity={0.7}
              >
                {archiving ? (
                  <ActivityIndicator size="small" color={tokens.accent} />
                ) : isArchived ? (
                  <ArchiveRestore size={20} color={tokens.accent} />
                ) : (
                  <Archive size={20} color={tokens.muted} />
                )}
              </TouchableOpacity>
            )}

            {isOwner && (
              <TouchableOpacity
                style={{ padding: 6, borderRadius: 8, backgroundColor: showShare ? tokens.primary : 'transparent' }}
                onPress={() => { setShowShare(true); setShowVersionHistory(false); setShowAIInsights(false); }}
                hitSlop={6}
                activeOpacity={0.7}
              >
                <Share2 size={20} color={showShare ? '#fff' : tokens.primary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={{ padding: 6, borderRadius: 8, backgroundColor: showVersionHistory ? tokens.primary : 'transparent' }}
              onPress={() => { setShowVersionHistory(true); setShowShare(false); setShowAIInsights(false); }}
              hitSlop={6}
              activeOpacity={0.7}
            >
              <History size={20} color={showVersionHistory ? '#fff' : tokens.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={{ padding: 6, borderRadius: 8, backgroundColor: showAIInsights ? tokens.accent : 'transparent' }}
              onPress={() => { setShowAIInsights(true); setShowVersionHistory(false); setShowShare(false); }}
              hitSlop={6}
              activeOpacity={0.7}
            >
              <Sparkles size={20} color={showAIInsights ? '#fff' : tokens.accent} />
            </TouchableOpacity>
          </View>
        </View>

        {isArchived && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: tokens.accentSoft, borderBottomWidth: 1, borderBottomColor: tokens.border }}>
            <Archive size={13} color={tokens.accent} />
            <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: tokens.accent }}>
              This note is archived. Unarchive it to enable editing.
            </Text>
            {isOwner && (
              <TouchableOpacity onPress={handleToggleArchive} activeOpacity={0.7}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.accent }}>Unarchive</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {collabReady && room.status !== 'joined' && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 6, backgroundColor: tokens.accentSoft, borderBottomWidth: 1, borderBottomColor: tokens.border }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.accent }}>
              {everJoined
                ? "Connection lost, reconnecting… your edits will sync when you're back."
                : 'Joining note…'}
            </Text>
          </View>
        )}

        {loadFailed && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: tokens.accentSoft, borderBottomWidth: 1, borderBottomColor: tokens.border }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.accent }}>
              Couldn't load this note's content, so editing is disabled to protect it. Go back and reopen the note.
            </Text>
          </View>
        )}
      </View>

      <View style={{ flex: 1, width: '100%', minHeight: 300, overflow: 'hidden' }}>
        <RichText editor={editor} style={{ flex: 1, width: '100%', backgroundColor: tokens.surface }} />
      </View>

      {canEdit && token && (
        <MobileEditorToolbar
          editor={editor}
          bottomInset={insets.bottom}
          noteId={noteId}
          token={token}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onUndo={() => collab.collabUndo()}
          onRedo={() => collab.collabRedo()}
        />
      )}

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
    </KeyboardAvoidingView>
  );
}

interface PresenceIndicatorProps {
  onlineCount: number;
  othersOnline: number;
  tokens: any;
}

function PresenceIndicator({ onlineCount, othersOnline, tokens }: PresenceIndicatorProps) {
  if (onlineCount === 0) return null;

  const isAlone = othersOnline === 0;
  const dotColor = isAlone ? tokens.muted : '#22c55e';
  const label = isAlone
    ? 'Only you'
    : `${othersOnline} other${othersOnline === 1 ? '' : 's'} online`;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: tokens.surfaceElevated, borderWidth: 1, borderColor: tokens.border }}>
      <View
        style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: dotColor }}
      />
      <Text style={{ fontSize: 10, fontWeight: '600', color: tokens.muted }}>{label}</Text>
    </View>
  );
}

function SaveIndicator({ status, tokens, isMidnight }: { status: SaveStatus; tokens: any; isMidnight: boolean }) {
  if (status === 'idle') return null;

  const colorMap = {
    saving: { text: tokens.accent, border: tokens.border, bg: tokens.accentSoft, icon: tokens.accent },
    saved: { text: tokens.success, border: tokens.border, bg: isMidnight ? '#0d2d1a' : '#e9f8ef', icon: tokens.success },
    error: { text: tokens.danger, border: tokens.border, bg: isMidnight ? '#3a1a1e' : '#ffe8e8', icon: tokens.danger },
  };
  const c = colorMap[status];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg }}>
      {status === 'saving' && <ActivityIndicator size={10} color={c.icon} />}
      {status === 'saved' && <CheckCircle2 size={11} color={c.icon} />}
      {status === 'error' && <AlertCircle size={11} color={c.icon} />}
      <Text style={{ fontSize: 10, fontWeight: '700', color: c.text }}>
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Failed'}
      </Text>
    </View>
  );
}
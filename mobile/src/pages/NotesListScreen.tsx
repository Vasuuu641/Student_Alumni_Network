// screens/NotesListScreen.tsx
// Mobile equivalent of src/pages/NotesListPage.tsx
// Requires: @react-navigation/native, lucide-react-native, react-native-safe-area-context

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Archive, Clock, FileText, Plus, X } from 'lucide-react-native';

import {
  createNote,
  listUserNotes,
  updateNote,
  type Note,
  type NoteStatus,
} from '../api/notes.api';
import { getValidAccessToken } from '../lib/auth-session';
import { getRoleFromAccessToken } from '../lib/jwt';
import type { RootStackParamList } from '../navigation/root-stack';
import { useTheme } from '../theme/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type NoteFilter = NoteStatus | 'ALL';

// ─── Screen ───────────────────────────────────────────────────────────────────

export function NotesListScreen() {
  const { tokens } = useTheme();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  // getAccessToken is async — resolve it once into state
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Use getValidAccessToken so expired tokens are refreshed before we check role.
    // Raw getAccessToken can return an expired token that getRoleFromAccessToken
    // fails to parse, producing role=null and an immediate redirect to Login.
    getValidAccessToken().then((t) => {
      setToken(t);
      setRole(t ? String(getRoleFromAccessToken(t)) : null);
      setAuthReady(true);
    });
  }, []);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NoteFilter>('ALL');

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Redirect once auth is resolved
  useEffect(() => {
    if (!authReady) return;
    if (!token || !role || role === 'ALUMNI') {
      navigation.replace('Login', undefined);
    }
  }, [authReady, token, role, navigation]);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchNotes = useCallback(async () => {
    if (!authReady || !token) return;
    try {
      setError(null);
      const { notes } = await listUserNotes(token);
      setNotes(notes);
    } catch {
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [authReady, token]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!token) return;
    const title = newTitle.trim() || 'Untitled document';
    try {
      setCreateError(null);
      setCreating(true);
      const { noteId } = await createNote(token, title);
      setShowCreateModal(false);
      setNewTitle('');
      navigation.navigate('NoteScreen', { noteId } as any);
    } catch {
      setCreateError('Failed to create note');
      setCreating(false);
    }
  }

  function openCreateModal() {
    setNewTitle('');
    setCreateError(null);
    setShowCreateModal(true);
  }

  async function handleArchive(noteId: string, current: NoteStatus) {
    if (!token) return;
    const next: NoteStatus = current === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    try {
      await updateNote(token, noteId, { status: next });
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, status: next } : n)));
    } catch {
      // silently fail — same as web
    }
  }

  // ─── Derived data ────────────────────────────────────────────────────────────

  const filtered = notes.filter((n) => filter === 'ALL' || n.status === filter);
  const activeCount = notes.filter((n) => n.status === 'ACTIVE').length;
  const archivedCount = notes.filter((n) => n.status === 'ARCHIVED').length;

  const filterTabs: Array<{ label: string; value: NoteFilter; count: number }> = [
    { label: 'All', value: 'ALL', count: notes.length },
    { label: 'Active', value: 'ACTIVE', count: activeCount },
    { label: 'Archived', value: 'ARCHIVED', count: archivedCount },
  ];

  const isMidnight = tokens.name === 'midnight';

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background, paddingTop: insets.top }}>
      <StatusBar style={isMidnight ? 'light' : 'dark'} />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 26, fontWeight: '700', color: tokens.text }}>
            {filter === 'ALL' ? 'My Notes' : filter === 'ACTIVE' ? 'Active' : 'Archived'}
          </Text>
          <Text style={{ fontSize: 13, color: tokens.muted, marginTop: 2 }}>
            {filtered.length} {filtered.length === 1 ? 'document' : 'documents'}
          </Text>
        </View>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: tokens.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 }}
          onPress={openCreateModal}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#fff" strokeWidth={2.5} />
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>New</Text>
        </TouchableOpacity>
      </View>

      {/* ── Filter tabs ─────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
        {filterTabs.map((tab) => {
          const isActive = filter === tab.value;
          return (
            <TouchableOpacity
              key={tab.value}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
                borderColor: isActive ? tokens.primary : tokens.border,
                backgroundColor: isActive ? tokens.primarySoft : tokens.surface
              }}
              onPress={() => setFilter(tab.value)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: isActive ? '700' : '500', color: isActive ? tokens.primary : tokens.muted }}>
                {tab.label}
              </Text>
              <View style={{ borderRadius: 10, minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, justifyContent: 'center', backgroundColor: isActive ? tokens.primarySoft : tokens.surfaceElevated }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: isActive ? tokens.primary : tokens.muted, textAlign: 'center' }}>
                  {tab.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {error && (
        <View style={{ marginHorizontal: 16, marginBottom: 10, borderRadius: 8, backgroundColor: isMidnight ? '#3a1a1e' : '#fde8e8', paddingHorizontal: 14, paddingVertical: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: tokens.danger }}>{error}</Text>
        </View>
      )}

      {/* ── Content ──────────────────────────────────────────────────── */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 64 }}>
          <ActivityIndicator size="large" color={tokens.primary} />
          <Text style={{ fontSize: 15, color: tokens.muted }}>Loading notes…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 64 }}>
          <FileText size={44} color={tokens.muted} strokeWidth={1.2} />
          <Text style={{ fontSize: 15, color: tokens.muted }}>
            {filter === 'ARCHIVED' ? 'No archived notes.' : 'No notes yet.'}
          </Text>
          {filter !== 'ARCHIVED' && (
            <TouchableOpacity
              style={{ marginTop: 4, backgroundColor: tokens.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
              onPress={openCreateModal}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Create first note</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              tokens={tokens}
              onPress={() => navigation.navigate('NoteScreen', { noteId: item.id } as any)}
              onArchive={() => handleArchive(item.id, item.status)}
            />
          )}
        />
      )}

      {/* ── Create Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setShowCreateModal(false)} />
          <View style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: tokens.surface, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, gap: 16 }}>
            {/* Modal header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: tokens.text }}>New document</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} hitSlop={12}>
                <X size={18} color={tokens.muted} />
              </TouchableOpacity>
            </View>

            {/* Title input */}
            <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}>
              <FileText size={15} color={tokens.muted} />
              <TextInput
                style={{ flex: 1, fontSize: 15, color: tokens.text }}
                placeholder="Document title (optional)"
                placeholderTextColor={tokens.muted}
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreate}
                maxLength={120}
              />
            </View>

            {createError && (
              <Text style={{ marginTop: -8, fontSize: 13, color: tokens.danger }}>{createError}</Text>
            )}

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: tokens.border, alignItems: 'center' }}
                onPress={() => setShowCreateModal(false)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.muted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: tokens.primary, alignItems: 'center', opacity: creating ? 0.6 : 1 }}
                onPress={handleCreate}
                disabled={creating}
                activeOpacity={0.8}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

// ─── Note Card ────────────────────────────────────────────────────────────────

interface NoteCardProps {
  note: Note;
  tokens: any;
  onPress: () => void;
  onArchive: () => void;
}

function NoteCard({ note, tokens, onPress, onArchive }: NoteCardProps) {
  const isArchived = note.status === 'ARCHIVED';
  return (
    <Pressable
      style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, gap: 12 }}
      onPress={onPress}
      android_ripple={{ color: tokens.primarySoft, borderless: false }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: isArchived ? tokens.surfaceElevated : tokens.primarySoft }}>
        <FileText size={18} color={isArchived ? tokens.muted : tokens.primary} />
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{ fontSize: 15, fontWeight: '600', color: isArchived ? tokens.muted : tokens.text }}
          numberOfLines={1}
        >
          {note.title || 'Untitled document'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Clock size={10} color={tokens.muted} />
          <Text style={{ fontSize: 11, color: tokens.muted }}>{formatRelativeDate(note.updatedAt)}</Text>
          {isArchived && (
            <View style={{ marginLeft: 4, borderRadius: 4, backgroundColor: tokens.surfaceElevated, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ fontSize: 10, color: tokens.muted, fontWeight: '600' }}>Archived</Text>
            </View>
          )}
        </View>
      </View>

      <Pressable
        style={{ padding: 4 }}
        onPress={(e) => { onArchive(); }}
        hitSlop={10}
      >
        <Archive size={15} color={tokens.muted} />
      </Pressable>
    </Pressable>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
// screens/NotesListScreen.tsx
// Mobile equivalent of src/pages/NotesListPage.tsx
// Requires: @react-navigation/native, lucide-react-native, react-native-safe-area-context

import { useCallback, useEffect, useState } from 'react'
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
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Archive, Clock, FileText, Plus, X } from 'lucide-react-native'

import {
  createNote,
  listUserNotes,
  updateNote,
  type Note,
  type NoteStatus,
} from '../api/notes.api'
import { getAccessToken } from '../lib/auth-storage'
import { getRoleFromAccessToken } from '../lib/jwt'
import type { RootStackParamList } from '../navigation/root-stack'

// ─── Types ────────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<RootStackParamList>

type NoteFilter = NoteStatus | 'ALL'

// ─── Screen ───────────────────────────────────────────────────────────────────

export function NotesListScreen() {
  const navigation = useNavigation<Nav>()
  const insets = useSafeAreaInsets()

   // getAccessToken is async — resolve it once into state
  const [token, setToken] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)

    useEffect(() => {
    getAccessToken().then((t) => {
      setToken(t)
      setRole(t ? String(getRoleFromAccessToken(t)) : null)
      setAuthReady(true)
      })
    }, [])
 
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<NoteFilter>('ALL')

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Redirect if not authed or ALUMNI
  useEffect(() => {
    if (!token || !role) {
      navigation.replace('Login')
    } else if (String(role) === 'ALUMNI') {
      navigation.replace('Login')
    }
  }, [token, role, navigation])

  // ─── Data fetching ──────────────────────────────────────────────────────────

    const fetchNotes = useCallback(async () => {
    if (!token) return
    try {
      setError(null)
      const { notes } = await listUserNotes(token)
      setNotes(notes)
    } catch {
      setError('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [token])
 
  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // ─── Actions ─────────────────────────────────────────────────────────────────

    async function handleCreate() {
    if (!token) return
    const title = newTitle.trim() || 'Untitled document'
    try {
      setCreateError(null)
      setCreating(true)
      const { noteId } = await createNote(token, title)
      setShowCreateModal(false)
      setNewTitle('')
      // TODO: add NoteDetail: { noteId: string } to RootStackParamList, then remove the cast
      navigation.navigate('NoteDetail' as any, { noteId } as any)
    } catch {
      setCreateError('Failed to create note')
      setCreating(false)
    }
  }


  function openCreateModal() {
    setNewTitle('')
    setCreateError(null)
    setShowCreateModal(true)
  }

  async function handleArchive(noteId: string, current: NoteStatus) {
    if (!token) return
    const next: NoteStatus = current === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE'
    try {
      await updateNote(token, noteId, { status: next })
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, status: next } : n)))
    } catch {
      // silently fail — same as web
    }
  }

  // ─── Derived data ────────────────────────────────────────────────────────────

  const filtered = notes.filter((n) => filter === 'ALL' || n.status === filter)
  const activeCount = notes.filter((n) => n.status === 'ACTIVE').length
  const archivedCount = notes.filter((n) => n.status === 'ARCHIVED').length

  const filterTabs: Array<{ label: string; value: NoteFilter; count: number }> = [
    { label: 'All', value: 'ALL', count: notes.length },
    { label: 'Active', value: 'ACTIVE', count: activeCount },
    { label: 'Archived', value: 'ARCHIVED', count: archivedCount },
  ]

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-[#f5f8ff]" style={{ paddingTop: insets.top }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
        <View>
          <Text className="text-[26px] font-bold text-[#101d36] -tracking-[0.5px]">
            {filter === 'ALL' ? 'My Notes' : filter === 'ACTIVE' ? 'Active' : 'Archived'}
          </Text>
          <Text className="text-[13px] text-[#5f7291] mt-0.5">
            {filtered.length} {filtered.length === 1 ? 'document' : 'documents'}
          </Text>
        </View>
        <TouchableOpacity
          className="flex-row items-center gap-[6px] bg-[#2f64f6] px-[14px] py-[9px] rounded-[10px]"
          onPress={openCreateModal}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#fff" strokeWidth={2.5} />
          <Text className="text-white font-semibold text-sm">New</Text>
        </TouchableOpacity>
      </View>

      {/* ── Filter tabs ─────────────────────────────────────────────── */}
      <View className="flex-row px-4 pb-3 gap-2">
        {filterTabs.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            className={`flex-row items-center gap-[6px] px-3 py-[6px] rounded-lg border ${
              filter === tab.value
                ? 'bg-[#eaf1ff] border-[#2f64f6]'
                : 'bg-white border-[#dce6f3]'
            }`}
            onPress={() => setFilter(tab.value)}
            activeOpacity={0.7}
          >
            <Text className={`text-[13px] font-medium ${filter === tab.value ? 'text-[#2f64f6] font-semibold' : 'text-[#5f7291]'}`}>
              {tab.label}
            </Text>
            <View className={`rounded-[10px] min-w-[20px] px-[5px] py-px items-center ${filter === tab.value ? 'bg-[#d0e0ff]' : 'bg-[#f0f4fa]'}`}>
              <Text className={`text-[11px] font-semibold ${filter === tab.value ? 'text-[#2f64f6]' : 'text-[#5f7291]'}`}>
                {tab.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {error && (
        <View className="mx-4 mb-[10px] bg-[#fde8e8] rounded-lg px-[14px] py-[10px]">
          <Text className="text-[13px] font-medium text-[#c53b4f]">{error}</Text>
        </View>
      )}

      {/* ── Content ──────────────────────────────────────────────────── */}
      {loading ? (
        <View className="flex-1 items-center justify-center gap-3 pb-16">
          <ActivityIndicator size="large" color="#2f64f6" />
          <Text className="text-[15px] text-[#5f7291]">Loading notes…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 pb-16">
          <FileText size={44} color="#94a3b8" strokeWidth={1.2} />
          <Text className="text-[15px] text-[#5f7291]">
            {filter === 'ARCHIVED' ? 'No archived notes.' : 'No notes yet.'}
          </Text>
          {filter !== 'ARCHIVED' && (
            <TouchableOpacity
              className="mt-1 bg-[#2f64f6] px-5 py-[10px] rounded-[10px]"
              onPress={openCreateModal}
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold text-sm">Create first note</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => navigation.navigate('Notes', { noteId: item.id } as any)}
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
          className="flex-1 bg-[rgba(10,20,40,0.35)] justify-end"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable className="absolute inset-0" onPress={() => setShowCreateModal(false)} />
          <View className="bg-white rounded-t-[20px] px-5 pt-5 pb-9 gap-4">
            {/* Modal header */}
            <View className="flex-row items-center justify-between">
              <Text className="text-[17px] font-bold text-[#101d36]">New document</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} hitSlop={12}>
                <X size={18} color="#5f7291" />
              </TouchableOpacity>
            </View>

            {/* Title input */}
            <View className="flex-row items-center bg-[#f5f8ff] rounded-[10px] border border-[#dce6f3] px-3 py-[11px] gap-2">
              <FileText size={15} color="#5f7291" />
              <TextInput
                className="flex-1 text-[15px] text-[#101d36]"
                placeholder="Document title (optional)"
                placeholderTextColor="#94a3b8"
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreate}
                maxLength={120}
              />
            </View>

            {createError && (
              <Text className="-mt-2 text-[13px] text-[#c53b4f]">{createError}</Text>
            )}

            {/* Actions */}
            <View className="flex-row gap-[10px]">
              <TouchableOpacity
                className="flex-1 py-3 rounded-[10px] border border-[#dce6f3] items-center"
                onPress={() => setShowCreateModal(false)}
                activeOpacity={0.7}
              >
                <Text className="text-sm font-semibold text-[#5f7291]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-[2] py-3 rounded-[10px] bg-[#2f64f6] items-center ${creating ? 'opacity-60' : ''}`}
                onPress={handleCreate}
                disabled={creating}
                activeOpacity={0.8}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-sm font-bold text-white">Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  )
}

// ─── Note Card ────────────────────────────────────────────────────────────────

interface NoteCardProps {
  note: Note
  onPress: () => void
  onArchive: () => void
}

function NoteCard({ note, onPress, onArchive }: NoteCardProps) {
  const isArchived = note.status === 'ARCHIVED'
  return (
    <TouchableOpacity
      className="flex-row items-center bg-white rounded-xl px-[14px] py-[14px] border border-[#dce6f3] gap-3 shadow-sm"
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View className={`w-9 h-9 rounded-lg items-center justify-center ${isArchived ? 'bg-[#f0f4fa]' : 'bg-[#eaf1ff]'}`}>
        <FileText size={18} color={isArchived ? '#94a3b8' : '#2f64f6'} />
      </View>

      <View className="flex-1 gap-1">
        <Text
          className={`text-[15px] font-semibold ${isArchived ? 'text-[#94a3b8]' : 'text-[#101d36]'}`}
          numberOfLines={1}
        >
          {note.title || 'Untitled document'}
        </Text>
        <View className="flex-row items-center gap-1">
          <Clock size={10} color="#94a3b8" />
          <Text className="text-[11px] text-[#94a3b8]">{formatRelativeDate(note.updatedAt)}</Text>
          {isArchived && (
            <View className="ml-1 bg-[#f0f4fa] rounded px-[5px] py-px">
              <Text className="text-[10px] text-[#94a3b8] font-semibold">Archived</Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity className="p-1" onPress={onArchive} hitSlop={10} activeOpacity={0.6}>
        <Archive size={15} color="#94a3b8" />
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
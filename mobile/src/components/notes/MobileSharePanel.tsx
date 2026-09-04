// components/notes/MobileSharePanel.tsx
// Mobile equivalent of src/components/notes/SharePanel.tsx
// Renders as a bottom sheet Modal

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
import { ChevronDown, Trash2, UserPlus, Users, X } from 'lucide-react-native'

import {
  listCollaborators,
  removeCollaborator,
  shareNote,
  updateCollaboratorRole,
  type NoteCollaborator,
  type NoteRole,
} from '../../api/notes.api'

interface Props {
  noteId: string
  token: string
  isOwner: boolean
  visible: boolean
  onClose: () => void
}

export function MobileSharePanel({ noteId, token, isOwner, visible, onClose }: Props) {
  const insets = useSafeAreaInsets()
  const [collaborators, setCollaborators] = useState<NoteCollaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invite form state
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer')
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [showRolePicker, setShowRolePicker] = useState(false)

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchCollaborators = useCallback(async () => {
    try {
      setError(null)
      const { collaborators } = await listCollaborators(token, noteId)
      setCollaborators(collaborators)
    } catch (err: any) {
      const msg = err?.response?.data?.message
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to load collaborators'))
    } finally {
      setLoading(false)
    }
  }, [token, noteId])

  useEffect(() => {
    if (visible) fetchCollaborators()
  }, [visible, fetchCollaborators])

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function handleShare() {
    if (!email.trim()) return
    try {
      setShareError(null)
      setSharing(true)
      await shareNote(token, noteId, email.trim(), role)
      setEmail('')
      setShareSuccess(true)
      setTimeout(() => setShareSuccess(false), 2500)
      fetchCollaborators()
    } catch (err: any) {
      const msg = err?.response?.data?.message
      setShareError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to share note'))
    } finally {
      setSharing(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: 'editor' | 'viewer') {
    try {
      await updateCollaboratorRole(token, noteId, userId, newRole)
      setCollaborators((prev) =>
        prev.map((c) =>
          c.userId === userId ? { ...c, role: newRole.toUpperCase() as NoteRole } : c,
        ),
      )
    } catch {
      setError('Failed to update role')
    }
  }

  async function handleRemove(userId: string) {
    try {
      await removeCollaborator(token, noteId, userId)
      setCollaborators((prev) => prev.filter((c) => c.userId !== userId))
    } catch {
      setError('Failed to remove collaborator')
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="absolute inset-0 bg-[rgba(10,20,40,0.4)]" onPress={onClose} />

      <KeyboardAvoidingView
        className="absolute bottom-0 left-0 right-0"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          className="bg-white rounded-t-[20px] px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          {/* Handle */}
          <View className="self-center w-9 h-1 rounded-full bg-[#dce6f3] mb-[14px]" />

          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2">
              <Users size={16} color="#2f64f6" />
              <Text className="text-[17px] font-bold text-[#101d36]">Share document</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={18} color="#5f7291" />
            </TouchableOpacity>
          </View>

          {/* Invite form — owners only */}
          {isOwner && (
            <View className="gap-[10px] mb-4 pb-4 border-b border-[#f0f4fa]">
              <View className="flex-row gap-2 items-center">
                <TextInput
                  className="flex-1 bg-[#f5f8ff] rounded-[10px] border border-[#dce6f3] px-3 py-[10px] text-sm text-[#101d36]"
                  placeholder="Email address"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleShare}
                />
                {/* Role selector */}
                <TouchableOpacity
                  className="flex-row items-center gap-1 bg-[#f0f4fa] rounded-lg border border-[#dce6f3] px-[10px] py-[10px]"
                  onPress={() => setShowRolePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text className="text-[13px] text-[#5f7291] font-medium">
                    {role === 'editor' ? 'Editor' : 'Viewer'}
                  </Text>
                  <ChevronDown size={12} color="#5f7291" />
                </TouchableOpacity>
              </View>

              {shareError && <Text className="text-xs text-[#c53b4f]">{shareError}</Text>}
              {shareSuccess && <Text className="text-xs text-[#1f8a4c] font-medium">Invitation sent!</Text>}

              <TouchableOpacity
                className={`flex-row items-center justify-center gap-[6px] bg-[#2f64f6] rounded-[10px] py-[11px] ${sharing ? 'opacity-60' : ''}`}
                onPress={handleShare}
                disabled={sharing}
                activeOpacity={0.8}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <UserPlus size={14} color="#fff" />
                    <Text className="text-white font-bold text-sm">Share</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Collaborators list */}
          <View className="gap-2">
            <Text className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
              {loading ? 'Loading…' : `${collaborators.length} ${collaborators.length === 1 ? 'collaborator' : 'collaborators'}`}
            </Text>
            {error && <Text className="text-xs text-[#c53b4f]">{error}</Text>}
            <FlatList
              data={collaborators}
              keyExtractor={(c) => c.userId}
              style={{ maxHeight: 280 }}
              ItemSeparatorComponent={() => <View className="h-px bg-[#f0f4fa]" />}
              renderItem={({ item }) => (
                <CollaboratorRow
                  collaborator={item}
                  isOwner={isOwner}
                  onRoleChange={handleRoleChange}
                  onRemove={handleRemove}
                />
              )}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Role picker bottom sheet */}
      <Modal
        visible={showRolePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRolePicker(false)}
      >
        <Pressable
          className="absolute inset-0 bg-[rgba(10,20,40,0.4)]"
          onPress={() => setShowRolePicker(false)}
        />
        <View className="absolute bottom-10 left-5 right-5 bg-white rounded-2xl p-4 gap-2 shadow-lg elevation-10">
          <Text className="text-[13px] font-semibold text-[#94a3b8] mb-1">Select role</Text>
          {(['viewer', 'editor'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              className={`flex-row items-center justify-between py-[11px] px-3 rounded-lg border ${
                role === r ? 'border-[#2f64f6] bg-[#eaf1ff]' : 'border-[#f0f4fa]'
              }`}
              onPress={() => { setRole(r); setShowRolePicker(false) }}
              activeOpacity={0.7}
            >
              <Text className={`text-sm font-medium ${role === r ? 'text-[#2f64f6] font-semibold' : 'text-[#5f7291]'}`}>
                {r === 'editor' ? 'Editor' : 'Viewer'}
              </Text>
              {role === r && <View className="w-2 h-2 rounded-full bg-[#2f64f6]" />}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </Modal>
  )
}

// ─── Collaborator row ─────────────────────────────────────────────────────────

interface RowProps {
  collaborator: NoteCollaborator
  isOwner: boolean
  onRoleChange: (userId: string, role: 'editor' | 'viewer') => void
  onRemove: (userId: string) => void
}

const roleBadgeClasses: Record<string, string> = {
  owner: 'bg-[#ede9fe]',
  editor: 'bg-[#dbeafe]',
  viewer: 'bg-[#f0f4fa]',
}

function CollaboratorRow({ collaborator, isOwner, onRoleChange, onRemove }: RowProps) {
  const [showRolePicker, setShowRolePicker] = useState(false)
  const baseName = collaborator.displayName?.trim() || collaborator.email
  const parts = baseName.split(' ').filter(Boolean)
  const initials = parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : baseName.slice(0, 2).toUpperCase()
  const isOwnerRow = collaborator.role === 'OWNER'
  const roleKey = collaborator.role.toLowerCase() as 'owner' | 'editor' | 'viewer'

  return (
    <View className="flex-row items-center py-[10px] gap-[10px]">
      {/* Avatar */}
      <View className="w-9 h-9 rounded-full bg-[#eaf1ff] items-center justify-center">
        <Text className="text-xs font-bold text-[#2f64f6]">{initials}</Text>
      </View>

      {/* Info */}
      <View className="flex-1 gap-0.5">
        <Text className="text-[13px] font-semibold text-[#101d36]" numberOfLines={1}>
          {baseName}
        </Text>
        <Text className="text-[11px] text-[#94a3b8]" numberOfLines={1}>
          {collaborator.email}
        </Text>
        <View className={`self-start rounded px-[5px] py-px mt-0.5 ${roleBadgeClasses[roleKey]}`}>
          <Text className="text-[10px] font-semibold text-[#5f7291]">{roleKey}</Text>
        </View>
      </View>

      {/* Actions (owner can modify non-owner rows) */}
      {isOwner && !isOwnerRow && (
        <View className="flex-row items-center gap-[10px]">
          <TouchableOpacity
            className="flex-row items-center gap-[3px] px-2 py-[5px] rounded-md border border-[#dce6f3]"
            onPress={() => setShowRolePicker(true)}
            activeOpacity={0.7}
          >
            <Text className="text-xs text-[#5f7291] font-medium">
              {collaborator.role === 'EDITOR' ? 'Editor' : 'Viewer'}
            </Text>
            <ChevronDown size={11} color="#5f7291" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onRemove(collaborator.userId)} hitSlop={8} activeOpacity={0.6}>
            <Trash2 size={14} color="#c53b4f" />
          </TouchableOpacity>
        </View>
      )}

      {/* Inline role picker */}
      <Modal
        visible={showRolePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRolePicker(false)}
      >
        <Pressable
          className="absolute inset-0 bg-[rgba(10,20,40,0.4)]"
          onPress={() => setShowRolePicker(false)}
        />
        <View className="absolute bottom-10 left-5 right-5 bg-white rounded-2xl p-4 gap-2 shadow-lg elevation-10">
          <Text className="text-[13px] font-semibold text-[#94a3b8] mb-1">
            Change role for {baseName}
          </Text>
          {(['viewer', 'editor'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              className={`flex-row items-center justify-between py-[11px] px-3 rounded-lg border ${
                collaborator.role.toLowerCase() === r
                  ? 'border-[#2f64f6] bg-[#eaf1ff]'
                  : 'border-[#f0f4fa]'
              }`}
              onPress={() => {
                onRoleChange(collaborator.userId, r)
                setShowRolePicker(false)
              }}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm font-medium ${
                  collaborator.role.toLowerCase() === r
                    ? 'text-[#2f64f6] font-semibold'
                    : 'text-[#5f7291]'
                }`}
              >
                {r === 'editor' ? 'Editor' : 'Viewer'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </View>
  )
}
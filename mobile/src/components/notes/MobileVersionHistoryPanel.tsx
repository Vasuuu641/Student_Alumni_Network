// components/notes/MobileVersionHistoryPanel.tsx
// Mobile equivalent of src/components/notes/VersionHistoryPanel.tsx
// Renders as a bottom sheet Modal instead of a sidebar

import { useCallback, useEffect, useState } from 'react'
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
import { Clock, History, RotateCcw, X } from 'lucide-react-native'

import { listVersions, restoreVersion } from '../../api/notes.api'
import { useCheckpointEvents } from '../../hooks/UseCheckpointEvents'
import {extractSnapshotPreview, formatDate} from "../../helpers/extractSnapshot";

interface NoteVersion {
  versionNumber: number
  createdAt: string
  createdBy?: string
  snapshotJson?: unknown
}

interface Props {
  noteId: string
  token: string
  canRestore: boolean
  visible: boolean
  onClose: () => void
  onRestored: () => void
}

export function MobileVersionHistoryPanel({
  noteId,
  token,
  canRestore,
  visible,
  onClose,
  onRestored,
}: Props) {
  const insets = useSafeAreaInsets()
  const [versions, setVersions] = useState<NoteVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null)
  const [confirmVisible, setConfirmVisible] = useState(false)

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchVersions = useCallback(async () => {
    try {
      setError(null)
      const { versions } = await listVersions(token, noteId)
      setVersions(versions)
    } catch {
      setError('Failed to load version history')
    } finally {
      setLoading(false)
    }
  }, [noteId, token])

  useEffect(() => {
    if (visible) fetchVersions()
  }, [visible, fetchVersions])

  // Auto-refresh on new checkpoint broadcast
  useCheckpointEvents(noteId, useCallback(() => {
    fetchVersions()
  }, [fetchVersions]))

  // ─── Restore ───────────────────────────────────────────────────────────────

  async function handleRestore() {
    if (!selectedVersion) return
    try {
      setRestoring(selectedVersion.versionNumber)
      await restoreVersion(token, noteId, selectedVersion.versionNumber)
      setConfirmVisible(false)
      setSelectedVersion(null)
      onRestored()
      onClose()
    } catch {
      setError(`Failed to restore version ${selectedVersion.versionNumber}`)
      setRestoring(null)
    }
  }

  function openConfirm(version: NoteVersion) {
    setSelectedVersion(version)
    setConfirmVisible(true)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Version list bottom sheet ─────────────────────────────── */}
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <Pressable className="absolute inset-0 bg-[rgba(10,20,40,0.4)]" onPress={onClose} />

        <View
          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[20px] px-5 pt-3"
          style={{ maxHeight: '75%', paddingBottom: insets.bottom + 16 }}
        >
          {/* Handle bar */}
          <View className="self-center w-9 h-1 rounded-full bg-[#dce6f3] mb-[14px]" />

          {/* Header */}
          <View className="flex-row items-center justify-between mb-0.5">
            <View className="flex-row items-center gap-2">
              <History size={16} color="#2f64f6" />
              <Text className="text-[17px] font-bold text-[#101d36]">Version history</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={18} color="#5f7291" />
            </TouchableOpacity>
          </View>

          <Text className="text-xs text-[#94a3b8] mb-4">
            Checkpoints saved by collaborators
          </Text>

          {/* Content */}
          {loading ? (
            <View className="items-center justify-center py-10 gap-[10px]">
              <ActivityIndicator color="#2f64f6" />
              <Text className="text-sm text-[#5f7291]">Loading versions…</Text>
            </View>
          ) : error ? (
            <View className="items-center justify-center py-10">
              <Text className="text-sm text-[#c53b4f]">{error}</Text>
            </View>
          ) : versions.length === 0 ? (
            <View className="items-center justify-center py-10 gap-[10px]">
              <Clock size={32} color="#94a3b8" strokeWidth={1.3} />
              <Text className="text-sm text-[#5f7291]">No versions saved yet</Text>
            </View>
          ) : (
            <FlatList
              data={versions}
              keyExtractor={(v) => String(v.versionNumber)}
              style={{ maxHeight: 340 }}
              ItemSeparatorComponent={() => <View className="h-px bg-[#f0f4fa] my-0.5" />}
              renderItem={({ item }) => (
                <View className="flex-row items-center py-3 gap-3">
                  {/* Timeline dot */}
                  <View className="w-2 h-2 rounded-full bg-[#2f64f6] mt-0.5" />

                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-semibold text-[#101d36]">
                      Version {item.versionNumber}
                    </Text>
                    <Text className="text-xs text-[#5f7291]">{formatDate(item.createdAt)}</Text>
                    <Text className="text-[11px] text-[#94a3b8]">
                      by {(item.createdBy ?? 'unknown').slice(0, 8)}…
                    </Text>
                  </View>

                  {canRestore && (
                    <TouchableOpacity
                      className="flex-row items-center gap-[5px] px-[10px] py-[6px] rounded-lg border border-[#2f64f6]"
                      onPress={() => openConfirm(item)}
                      activeOpacity={0.7}
                    >
                      <RotateCcw size={13} color="#2f64f6" />
                      <Text className="text-xs font-semibold text-[#2f64f6]">Restore</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      {/* ── Confirm restore modal ────────────────────────────────────── */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <Pressable
          className="absolute inset-0 bg-[rgba(10,20,40,0.5)]"
          onPress={() => setConfirmVisible(false)}
        />
        <View className="absolute left-5 right-5 top-[25%] bg-white rounded-2xl p-5 gap-3 shadow-lg elevation-10">
          <Text className="text-base font-bold text-[#101d36]">
            Restore Version {selectedVersion?.versionNumber}?
          </Text>
          <Text className="text-[13px] text-[#5f7291] leading-5">
            Saved {selectedVersion ? formatDate(selectedVersion.createdAt) : ''}{'\n'}
            This will overwrite the current document content.
          </Text>

          {/* Snapshot preview */}
          {selectedVersion?.snapshotJson && (
            <ScrollView
              className="bg-[#f5f8ff] rounded-lg p-[10px] border border-[#dce6f3]"
              style={{ maxHeight: 120 }}
              nestedScrollEnabled
            >
              <Text className="text-xs text-[#5f7291] leading-[18px]">
                {extractSnapshotPreview(selectedVersion.snapshotJson) || 'No preview available.'}
              </Text>
            </ScrollView>
          )}

          <View className="flex-row gap-[10px] mt-1">
            <TouchableOpacity
              className="flex-1 py-[11px] rounded-[10px] border border-[#dce6f3] items-center"
              onPress={() => setConfirmVisible(false)}
              activeOpacity={0.7}
            >
              <Text className="text-sm font-semibold text-[#5f7291]">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-[2] flex-row items-center justify-center gap-[6px] py-[11px] rounded-[10px] bg-[#2f64f6] ${restoring !== null ? 'opacity-60' : ''}`}
              onPress={handleRestore}
              disabled={restoring !== null}
              activeOpacity={0.8}
            >
              {restoring !== null ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <RotateCcw size={13} color="#fff" />
                  <Text className="text-sm font-bold text-white">Restore</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

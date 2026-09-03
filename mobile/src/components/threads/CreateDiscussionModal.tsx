import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { faImage, faTimesCircle, faX } from '@fortawesome/free-solid-svg-icons';
import * as ImagePicker from 'expo-image-picker';
import type { ThreadPanel } from '../../api/threads.api';
import { createThread, createThreadsSocket } from '../../api/threads.api';
import SimilarThreadsPanel, { type SimilarThreadItem } from './SimilarThreadsPanel';

const MIN_SIMILARITY_CHARS = 10;
const MAX_ATTACHMENTS = 5;

type PickedAttachment = { uri: string; name: string; type: string };

export default function CreateDiscussionModal({
  visible,
  onClose,
  panel,
  token,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  panel: ThreadPanel;
  token: string | null;
  onCreated?: (threadId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PickedAttachment[]>([]);

  const [similarityLoading, setSimilarityLoading] = useState(false);
  const [similarItems, setSimilarItems] = useState<SimilarThreadItem[]>([]);

  const socket = useMemo(() => {
    if (!token) return null;
    try {
      return createThreadsSocket(token);
    } catch {
      return null;
    }
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    const handle = (payload: { results: SimilarThreadItem[] }) => {
      setSimilarityLoading(false);
      setSimilarItems(payload.results ?? []);
    };

    socket.on('threads:similarity-results', handle);
    return () => {
      socket.off('threads:similarity-results', handle);
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setDescription('');
      setError(null);
      setSimilarItems([]);
      setSimilarityLoading(false);
      setAttachments([]);
      return;
    }

    const query = `${title} ${description}`.trim();
    if (query.length < MIN_SIMILARITY_CHARS) {
      setSimilarItems([]);
      setSimilarityLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      if (!socket || !socket.connected) return;
      setSimilarityLoading(true);
      socket.emit('threads:typing-similarity', { query, panel });
    }, 350);

    return () => clearTimeout(timer);
  }, [title, description, socket, visible, panel]);

  async function handlePickAttachment() {
    if (attachments.length >= MAX_ATTACHMENTS) {
      setError(`You can attach up to ${MAX_ATTACHMENTS} files.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Permission to access photos is required to attach an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setError(null);
    setAttachments((prev) => [
      ...prev,
      {
        uri: asset.uri,
        name: asset.fileName ?? `attachment-${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      },
    ]);
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Please enter a discussion title.');
      return;
    }

    if (!token) {
      setError('Not authenticated.');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      const { threadId } = await createThread(token, {
        title: trimmed,
        description: description.trim() || undefined,
        panel,
        attachments,
      });
      setTitle('');
      setDescription('');
      setAttachments([]);
      if (onCreated) onCreated(threadId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create discussion.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center justify-between border-b border-[#e6edf7] bg-white px-4 py-4">
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-[#101d36]">Start a Discussion</Text>
            <Text className="mt-1 text-sm text-[#6a7b98]">{panel === 'ACADEMIC' ? 'Ask a doubt or discuss academic topics.' : 'Share a career question for alumni and professors.'}</Text>
          </View>
          <Pressable onPress={onClose} className="ml-2">
            <FontAwesomeIcon icon={faX as IconProp} size={20} color="#6a7b98" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {error ? (
            <View className="mb-3 rounded-2xl border border-[#fbb5b5] bg-[#ffe8e8] px-4 py-3">
              <Text className="text-sm font-semibold text-[#d24f4f]">{error}</Text>
            </View>
          ) : null}

          <View className="mb-4">
            <Text className="text-sm font-semibold text-[#6f829f]">Title</Text>
            <TextInput value={title} onChangeText={setTitle} maxLength={255} placeholder="What is your question or topic?" placeholderTextColor="#9ca3af" editable={!isCreating} className="mt-2 rounded-2xl border border-[#dde6f5] bg-white px-4 py-3 text-sm text-[#1f2937]" />
            <Text className="mt-1 text-xs text-[#9ca3af]">{title.length} / 255</Text>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-[#6f829f]">Content (optional)</Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="Share more details about your topic..." placeholderTextColor="#9ca3af" multiline numberOfLines={5} editable={!isCreating} className="mt-2 rounded-2xl border border-[#dde6f5] bg-white px-4 py-3 text-sm text-[#1f2937]" style={{ minHeight: 120 }} />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-[#6f829f]">Attachments (optional)</Text>

            {attachments.length > 0 ? (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <View key={`${file.uri}-${index}`} className="relative">
                    <Image source={{ uri: file.uri }} style={{ width: 72, height: 72, borderRadius: 12 }} />
                    <Pressable
                      onPress={() => removeAttachment(index)}
                      className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-white"
                      style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3 }}
                    >
                      <FontAwesomeIcon icon={faTimesCircle as IconProp} size={18} color="#d24f4f" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable
              onPress={() => void handlePickAttachment()}
              disabled={isCreating}
              className="mt-2 flex-row items-center gap-2 self-start rounded-2xl border border-dashed border-[#c7d5f0] bg-[#f8faff] px-4 py-3"
            >
              <FontAwesomeIcon icon={faImage as IconProp} size={15} color="#2f64f6" />
              <Text className="text-sm font-semibold text-[#2f64f6]">Add image</Text>
            </Pressable>
          </View>

          <View className="mb-6 rounded-2xl bg-[#f0f4ff] p-3">
            <Text className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6a7b98]">Posting to: {panel === 'ACADEMIC' ? 'Academic Discussions' : 'Career Advice'}</Text>
          </View>

          <SimilarThreadsPanel items={similarItems} loading={similarityLoading} onSelect={(item) => {
            onClose();
          }} />
        </ScrollView>

        <View className="border-t border-[#e6edf7] bg-white px-4 py-4">
          <View className="flex-row gap-3">
            <Pressable onPress={onClose} disabled={isCreating} className="flex-1 rounded-2xl border border-[#dde6f5] bg-white px-4 py-3">
              <Text className="text-center text-sm font-semibold text-[#5f7291]">Cancel</Text>
            </Pressable>
            <Pressable onPress={() => void handleSubmit()} disabled={isCreating || !title.trim()} className={`flex-1 rounded-2xl px-4 py-3 ${isCreating || !title.trim() ? 'bg-[#a8bde8]' : 'bg-[#2f64f6]'}`}>
              <Text className="text-center text-sm font-bold text-white">{isCreating ? 'Posting…' : 'Post Discussion'}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
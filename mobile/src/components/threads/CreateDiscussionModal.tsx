import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { faX } from '@fortawesome/free-solid-svg-icons';
import type { ThreadPanel } from '../../api/threads.api';
import { createThread, createThreadsSocket } from '../../api/threads.api';
import SimilarThreadsPanel, { type SimilarThreadItem } from './SimilarThreadsPanel';

const MIN_SIMILARITY_CHARS = 10;

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
      const { threadId } = await createThread(token, { title: trimmed, description: description.trim() || undefined, panel });
      setTitle('');
      setDescription('');
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

          <View className="mb-6 rounded-2xl bg-[#f0f4ff] p-3">
            <Text className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6a7b98]">Posting to: {panel === 'ACADEMIC' ? 'Academic Discussions' : 'Career Advice'}</Text>
          </View>

          <SimilarThreadsPanel items={similarItems} loading={similarityLoading} onSelect={(item) => {
            // navigate to thread when user selects a suggested similar thread
            // here we simply close and rely on parent to navigate if provided via onCreated
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

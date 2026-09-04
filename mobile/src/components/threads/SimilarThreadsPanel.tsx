import { View, Pressable, Text } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import React from 'react';

export type SimilarThreadItem = {
  threadId: string;
  title: string;
  similarityScore: number;
  panel: 'ACADEMIC' | 'ALUMNI';
};

export function SimilarThreadsPanel({
  items,
  loading,
  onSelect,
}: {
  items: SimilarThreadItem[];
  loading: boolean;
  onSelect: (item: SimilarThreadItem) => void;
}) {
  return (
    <View className="rounded-2xl border border-[#e6edf8] bg-white p-3">
      <Text className="text-sm font-semibold text-[#2f64f6]">Start typing — similarity search begins after 10 characters.</Text>
      <View className="mt-3 min-h-[80px]">
        {loading ? (
          <Text className="text-sm text-[#7182a0]">Looking for similar discussions…</Text>
        ) : items.length === 0 ? (
          <View className="rounded-lg border border-dashed border-[#d8e2f4] bg-[#fafcff] p-3">
            <Text className="text-sm text-[#7182a0]">Similar discussions will appear here as you type.</Text>
          </View>
        ) : (
          items.map((item) => (
            <Pressable key={item.threadId} onPress={() => onSelect(item)} className="py-2">
              <View className="flex-row items-center gap-2">
                <View className="min-w-[44px] items-center justify-center">
                  <Text className="text-sm font-bold text-[#335fd8]">{Math.round(item.similarityScore * 100)}%</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-[#24334d]">{item.title}</Text>
                  <Text className="text-xs text-[#60708a] mt-1">{item.panel === 'ALUMNI' ? 'Career' : 'Academic'} panel</Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

export default SimilarThreadsPanel;

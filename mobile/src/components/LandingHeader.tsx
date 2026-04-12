import { Pressable, Text, View } from 'react-native';
import { BridgeLogo } from './BridgeLogo';

export function LandingHeader() {
  return (
    <View className="min-h-[74px] flex-row items-center justify-between border-b border-[#eef3fb] bg-white px-4">
      <View className="flex-row items-center gap-2">
        <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-primary">
          <BridgeLogo size={17} color="#ffffff" />
        </View>
        <Text className="text-lg font-bold text-ink">UniBridge</Text>
      </View>

      <View className="flex-row items-center gap-2">
        <Pressable className="rounded-[10px] px-[10px] py-2">
          <Text className="text-sm font-semibold text-muted">Sign In</Text>
        </Pressable>
        <Pressable className="rounded-[10px] bg-primary px-3 py-2">
          <Text className="text-sm font-bold text-white">Get Started</Text>
        </Pressable>
      </View>
    </View>
  );
}

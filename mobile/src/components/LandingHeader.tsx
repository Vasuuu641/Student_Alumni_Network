import { Pressable, Text, View } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faBridge } from '@fortawesome/free-solid-svg-icons';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';

type LandingHeaderProps = {
  onPressSignIn?: () => void;
  onPressGetStarted?: () => void;
};

export function LandingHeader({ onPressSignIn, onPressGetStarted }: LandingHeaderProps) {
  return (
    <View className="min-h-[74px] flex-row items-center justify-between border-b border-[#eef3fb] bg-white px-4">
      <View className="flex-row items-center gap-2">
        <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-primary">
          <FontAwesomeIcon icon={faBridge as IconProp} size={15} color="#ffffff" />
        </View>
        <Text className="text-lg font-bold text-ink">UniBridge</Text>
      </View>

      <View className="flex-row items-center gap-2">
        <Pressable className="rounded-[10px] px-[10px] py-2" onPress={onPressSignIn}>
          <Text className="text-sm font-semibold text-muted">Sign In</Text>
        </Pressable>
        <Pressable className="rounded-[10px] bg-primary px-3 py-2" onPress={onPressGetStarted}>
          <Text className="text-sm font-bold text-white">Get Started</Text>
        </Pressable>
      </View>
    </View>
  );
}

import { Pressable, Text, View } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faBridge } from '@fortawesome/free-solid-svg-icons';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { useTheme, useThemePicker } from '../theme/theme';

type LandingHeaderProps = {
  onPressSignIn?: () => void;
  onPressGetStarted?: () => void;
  showThemeButton?: boolean;
};

export function LandingHeader({ onPressSignIn, onPressGetStarted, showThemeButton = true }: LandingHeaderProps) {
  const { tokens } = useTheme();
  const { openThemePicker } = useThemePicker();

  return (
    <View
      className="min-h-[74px] flex-row items-center justify-between border-b border-[#eef3fb] bg-white px-4"
      style={{ backgroundColor: tokens.surface, borderBottomColor: tokens.border }}
    >
      <View className="flex-row items-center gap-2">
        <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ backgroundColor: tokens.primary }}>
          <FontAwesomeIcon icon={faBridge as IconProp} size={15} color="#ffffff" />
        </View>
        <Text className="text-lg font-bold text-ink" style={{ color: tokens.text }}>UniBridge</Text>
      </View>

      <View className="flex-row items-center gap-2">
        {showThemeButton ? (
          <Pressable className="rounded-[10px] px-[10px] py-2" onPress={openThemePicker}>
            <Text className="text-sm font-semibold text-muted" style={{ color: tokens.primary }}>Theme</Text>
          </Pressable>
        ) : null}
        <Pressable className="rounded-[10px] px-[10px] py-2" onPress={onPressSignIn}>
          <Text className="text-sm font-semibold text-muted" style={{ color: tokens.muted }}>Sign In</Text>
        </Pressable>
        <Pressable className="rounded-[10px] bg-primary px-3 py-2" onPress={onPressGetStarted} style={{ backgroundColor: tokens.primary }}>
          <Text className="text-sm font-bold text-white">Get Started</Text>
        </Pressable>
      </View>
    </View>
  );
}

import { Pressable, Text, View } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faBridge, faPalette } from '@fortawesome/free-solid-svg-icons';
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
      className="min-h-[60px] flex-row items-center justify-between border-b px-4"
      style={{ backgroundColor: tokens.surface, borderBottomColor: tokens.border }}
    >
      {/* Logo */}
      <View className="flex-row items-center gap-2">
        <View
          className="h-8 w-8 items-center justify-center rounded-[9px]"
          style={{ backgroundColor: tokens.primary }}
        >
          <FontAwesomeIcon icon={faBridge as IconProp} size={14} color="#ffffff" />
        </View>
        <Text className="text-[17px] font-extrabold" style={{ color: tokens.text }}>
          UniBridge
        </Text>
      </View>

      {/* Actions */}
      <View className="flex-row items-center gap-1">
        {/* Theme picker — icon only, no label */}
        {showThemeButton && (
          <Pressable
            onPress={openThemePicker}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: tokens.primarySoft }}
          >
            <FontAwesomeIcon icon={faPalette as IconProp} size={16} color={tokens.primary} />
          </Pressable>
        )}

        {/* Sign In — compact */}
        <Pressable
          onPress={onPressSignIn}
          className="rounded-lg px-3 py-2"
        >
          <Text className="text-sm font-semibold" style={{ color: tokens.muted }}>
            Sign In
          </Text>
        </Pressable>

        {/* Get Started */}
        <Pressable
          onPress={onPressGetStarted}
          className="rounded-lg px-3 py-2"
          style={{ backgroundColor: tokens.primary }}
        >
          <Text className="text-sm font-bold text-white">Get Started</Text>
        </Pressable>
      </View>
    </View>
  );
}
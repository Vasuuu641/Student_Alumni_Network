import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeName = 'ocean' | 'crimson' | 'rose' | 'midnight';

export interface ThemeTokens {
  name: ThemeName;
  label: string;
  description: string;
  primary: string;
  primaryStrong: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  muted: string;
  success: string;
  danger: string;
}

const STORAGE_KEY = 'unibridge.theme';

export const THEMES: Record<ThemeName, ThemeTokens> = {
  ocean: {
    name: 'ocean',
    label: 'Ocean Blue',
    description: 'Clean blue UI with warm yellow action accents.',
    primary: '#2f64f6',
    primaryStrong: '#1f4fd1',
    primarySoft: '#eaf1ff',
    accent: '#f4a300',
    accentSoft: '#fff4cf',
    background: '#f5f8ff',
    surface: '#ffffff',
    surfaceElevated: '#fbfdff',
    border: '#dce6f3',
    text: '#101d36',
    muted: '#5f7291',
    success: '#1f8a4c',
    danger: '#c53b4f',
  },
  crimson: {
    name: 'crimson',
    label: 'Crimson',
    description: 'Bold crimson focus with warm gold CTAs.',
    primary: '#e11d48',
    primaryStrong: '#be123c',
    primarySoft: '#ffe4eb',
    accent: '#f4a300',
    accentSoft: '#fff4cf',
    background: '#fff9fa',
    surface: '#ffffff',
    surfaceElevated: '#fffdfd',
    border: '#f1cbd3',
    text: '#1f1720',
    muted: '#7a5665',
    success: '#15803d',
    danger: '#c81d3a',
  },
  rose: {
    name: 'rose',
    label: 'Rose',
    description: 'Soft rose palette with airy surfaces.',
    primary: '#ec4899',
    primaryStrong: '#db2777',
    primarySoft: '#ffedf5',
    accent: '#f59e0b',
    accentSoft: '#fff3cd',
    background: '#fff8fb',
    surface: '#ffffff',
    surfaceElevated: '#fffdfd',
    border: '#f3d2e1',
    text: '#221520',
    muted: '#80576f',
    success: '#15803d',
    danger: '#c81d3a',
  },
  midnight: {
    name: 'midnight',
    label: 'Midnight Blue',
    description: 'Dark mode with blue highlights and deep surfaces.',
    primary: '#4b80f8',
    primaryStrong: '#2f64f6',
    primarySoft: '#14213d',
    accent: '#f4a300',
    accentSoft: '#3a2a08',
    background: '#081120',
    surface: '#0e1628',
    surfaceElevated: '#121c31',
    border: '#24324d',
    text: '#f4f7fb',
    muted: '#9aa9c3',
    success: '#2dd4a3',
    danger: '#ff7a8a',
  },
};

interface ThemeContextValue {
  theme: ThemeName;
  tokens: ThemeTokens;
  setTheme: (theme: ThemeName) => void;
}

interface ThemePickerContextValue {
  openThemePicker: () => void;
  closeThemePicker: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const ThemePickerContext = createContext<ThemePickerContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('ocean');
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTheme() {
      const storedTheme = await AsyncStorage.getItem(STORAGE_KEY);
      if (cancelled) {
        return;
      }

      if (storedTheme && storedTheme in THEMES) {
        setThemeState(storedTheme as ThemeName);
      }
    }

    void loadTheme();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const tokens = THEMES[theme];

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      tokens,
      setTheme: setThemeState,
    }),
    [theme, tokens],
  );

  const pickerValue = useMemo<ThemePickerContextValue>(
    () => ({
      openThemePicker: () => setIsPickerOpen(true),
      closeThemePicker: () => setIsPickerOpen(false),
    }),
    [],
  );

  return (
    <ThemeContext.Provider value={value}>
      <ThemePickerContext.Provider value={pickerValue}>
        {children}

        <Modal visible={isPickerOpen} transparent animationType="fade" onRequestClose={() => setIsPickerOpen(false)}>
          <Pressable className="flex-1 justify-end bg-black/30 px-4 pb-6" onPress={() => setIsPickerOpen(false)}>
            <Pressable
              onPress={(event) => event.stopPropagation()}
              className="overflow-hidden rounded-[24px] border border-[#dce6f3] bg-white p-4"
            >
              <Text className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#5f7291]">Choose Theme</Text>

              <ScrollView className="mt-3 max-h-[420px]" showsVerticalScrollIndicator={false}>
                {Object.values(THEMES).map((item) => {
                  const isActive = item.name === theme;

                  return (
                    <Pressable
                      key={item.name}
                      onPress={() => {
                        setThemeState(item.name);
                        setIsPickerOpen(false);
                      }}
                      className={`mb-2 flex-row items-center gap-3 rounded-2xl border px-3 py-3 ${
                        isActive ? 'border-[#2f64f6] bg-[#eef4ff]' : 'border-[#e7edf8] bg-white'
                      }`}
                    >
                      <View className="h-4 w-4 rounded-full" style={{ backgroundColor: item.primary }} />
                      <View className="flex-1">
                        <Text className="text-[15px] font-bold text-[#101d36]">{item.label}</Text>
                        <Text className="mt-0.5 text-[12px] text-[#6a7b98]">{item.description}</Text>
                      </View>
                      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: item.accent }} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </ThemePickerContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}

export function useThemePicker() {
  const context = useContext(ThemePickerContext);

  if (!context) {
    throw new Error('useThemePicker must be used within ThemeProvider');
  }

  return context;
}

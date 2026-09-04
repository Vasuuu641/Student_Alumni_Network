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
      if (cancelled) return;
      if (storedTheme && storedTheme in THEMES) {
        setThemeState(storedTheme as ThemeName);
      }
    }
    void loadTheme();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const tokens = THEMES[theme];

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, tokens, setTheme: setThemeState }),
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

        {/* ── Theme picker modal — fully themed ────────────────────────────── */}
        <Modal
          visible={isPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsPickerOpen(false)}
        >
          <Pressable
            style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 16, paddingBottom: 24 }}
            onPress={() => setIsPickerOpen(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                borderRadius: 24,
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: tokens.surface,
                padding: 16,
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: tokens.muted, marginBottom: 12 }}>
                Choose Theme
              </Text>

              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {Object.values(THEMES).map((item) => {
                  const isActive = item.name === theme;
                  return (
                    <Pressable
                      key={item.name}
                      onPress={() => { setThemeState(item.name); setIsPickerOpen(false); }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: isActive ? item.primary : tokens.border,
                        backgroundColor: isActive ? item.primarySoft : tokens.surfaceElevated,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        marginBottom: 8,
                      }}
                    >
                      {/* Theme colour dot */}
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: item.primary, alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: item.accent }} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: tokens.text }}>{item.label}</Text>
                        <Text style={{ fontSize: 12, color: tokens.muted, marginTop: 2 }}>{item.description}</Text>
                      </View>

                      {/* Active check */}
                      {isActive && (
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: item.primary, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>✓</Text>
                        </View>
                      )}
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
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

export function useThemePicker() {
  const context = useContext(ThemePickerContext);
  if (!context) throw new Error('useThemePicker must be used within ThemeProvider');
  return context;
}
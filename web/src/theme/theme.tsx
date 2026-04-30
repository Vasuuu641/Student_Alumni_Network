import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
  shadow: string;
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
    shadow: '0 18px 50px rgba(47, 100, 246, 0.12)',
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
    shadow: '0 18px 50px rgba(225, 29, 72, 0.12)',
  },
  rose: {
    name: 'rose',
    label: 'Rose',
    description: 'Soft rose palette with calm, airy surfaces.',
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
    shadow: '0 18px 50px rgba(236, 72, 153, 0.10)',
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
    shadow: '0 18px 50px rgba(8, 17, 32, 0.32)',
  },
};

interface ThemeContextValue {
  theme: ThemeName;
  tokens: ThemeTokens;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeVariables(tokens: ThemeTokens): void {
  const root = document.documentElement;
  root.dataset.theme = tokens.name;

  const map: Record<string, string> = {
    '--theme-primary': tokens.primary,
    '--theme-primary-strong': tokens.primaryStrong,
    '--theme-primary-soft': tokens.primarySoft,
    '--theme-accent': tokens.accent,
    '--theme-accent-soft': tokens.accentSoft,
    '--theme-bg': tokens.background,
    '--theme-surface': tokens.surface,
    '--theme-surface-elevated': tokens.surfaceElevated,
    '--theme-border': tokens.border,
    '--theme-text': tokens.text,
    '--theme-muted': tokens.muted,
    '--theme-success': tokens.success,
    '--theme-danger': tokens.danger,
    '--theme-shadow': tokens.shadow,
  };

  for (const [key, value] of Object.entries(map)) {
    root.style.setProperty(key, value);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') {
      return 'ocean';
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && stored in THEMES ? (stored as ThemeName) : 'ocean';
  });

  const tokens = THEMES[theme];

  useEffect(() => {
    applyThemeVariables(tokens);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, tokens]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      tokens,
      setTheme: (nextTheme) => setThemeState(nextTheme),
    }),
    [theme, tokens],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}

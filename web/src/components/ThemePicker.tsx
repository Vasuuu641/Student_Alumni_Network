import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Palette } from 'lucide-react';
import { THEMES, type ThemeName, useTheme } from '../theme/theme';

interface ThemePickerProps {
  compact?: boolean;
}

export function ThemePicker({ compact = false }: ThemePickerProps) {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const themeList = useMemo(
    () => Object.values(THEMES),
    [],
  );

  const current = THEMES[theme];

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  return (
    <div className="theme-picker" ref={rootRef}>
      <button
        type="button"
        className={`theme-picker__button ${compact ? 'theme-picker__button--compact' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Choose theme. Current theme: ${current.label}`}
        title={current.label}
      >
        <Palette size={14} />
        {!compact ? <span>{current.label}</span> : null}
        {!compact ? <ChevronDown size={13} /> : null}
      </button>

      {isOpen ? (
        <div className="theme-picker__menu" role="menu" aria-label="Choose theme">
          <div className="theme-picker__title">Choose Theme</div>
          {themeList.map((item) => {
            const isActive = item.name === theme;

            return (
              <button
                key={item.name}
                type="button"
                className={`theme-picker__item ${isActive ? 'theme-picker__item--active' : ''}`}
                onClick={() => {
                  setTheme(item.name as ThemeName);
                  setIsOpen(false);
                }}
                role="menuitem"
              >
                <span className="theme-picker__swatch" style={{ background: item.primary }} aria-hidden="true" />
                <span className="theme-picker__item-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <span className="theme-picker__dot" aria-hidden="true" style={{ background: item.accent }} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
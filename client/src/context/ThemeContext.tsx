import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface Skin { key: string; label: string; color: string; }

// HeroUI Pro-style color schemes. Each maps to a [data-skin] CSS ramp + a
// HeroUI tailwind theme (`<skin>` / `<skin>-dark`).
export const SKINS: Skin[] = [
  { key: 'default', label: '经典蓝', color: '#2b54f0' },
  { key: 'violet', label: '锐紫', color: '#7c3aed' },
  { key: 'emerald', label: '翡翠', color: '#059f76' },
  { key: 'sunset', label: '落日橙', color: '#ef6c12' },
  { key: 'rose', label: '玫瑰', color: '#e11d6b' },
  { key: 'cyan', label: '青碧', color: '#0e8fb8' },
];
const SKIN_KEYS = SKINS.map((s) => s.key);

type Mode = 'light' | 'dark';

function initMode(): Mode {
  try {
    const q = new URLSearchParams(location.search).get('theme');
    if (q === 'dark' || q === 'light') return q;
    const saved = localStorage.getItem('haha_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch { return 'light'; }
}
function initSkin(): string {
  try {
    const saved = localStorage.getItem('haha_skin');
    return saved && SKIN_KEYS.includes(saved) ? saved : 'default';
  } catch { return 'default'; }
}

export interface ThemeValue {
  theme: Mode;
  toggle: () => void;
  isDark: boolean;
  skin: string;
  setSkin: (s: string) => void;
  skins: Skin[];
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children?: ReactNode }) {
  const [theme, setTheme] = useState<Mode>(initMode);
  const [skin, setSkinState] = useState<string>(initSkin);

  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = theme;
    el.dataset.skin = skin;
    // HeroUI tailwind theme class (used by converted HeroUI components)
    el.classList.forEach((c) => { if (/-dark$/.test(c) || SKIN_KEYS.includes(c)) el.classList.remove(c); });
    el.classList.add(theme === 'dark' ? `${skin}-dark` : skin);
    try {
      localStorage.setItem('haha_theme', theme);
      localStorage.setItem('haha_skin', skin);
    } catch { /* storage may be unavailable */ }
    const meta = document.querySelector('meta[name="theme-color"]:not([media])')
      || document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0d0f14' : '#ffffff');
  }, [theme, skin]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const setSkin = useCallback((s: string) => { if (SKIN_KEYS.includes(s)) setSkinState(s); }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle, isDark: theme === 'dark', skin, setSkin, skins: SKINS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = (): ThemeValue => useContext(ThemeContext) as ThemeValue;

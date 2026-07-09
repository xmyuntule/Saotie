import { createContext, useContext, useState, useLayoutEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { ReactNode } from 'react';

export interface Skin { key: string; label: string; color: string; }
export interface VisualStyle { key: string; label: string; desc: string; }

// 视觉风格 (S)：在配色 skin 之上叠加的「质感」维度——圆角/字体/阴影/点缀。
// 映射到 [data-style] 的 token 覆盖（见 styles/styles.css）。
export const STYLES: VisualStyle[] = [
  { key: 'modern', label: '现代', desc: '克制清爽 · 默认' },
  { key: 'refined', label: '高级', desc: '精致细腻 · 收紧圆角' },
  { key: 'cute', label: '可爱', desc: '大圆角 · 柔和俏皮' },
  { key: 'anime', label: '二次元', desc: '鲜亮 · 渐变活泼' },
];
const STYLE_KEYS = STYLES.map((s) => s.key);

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
export interface ThemeTransitionOrigin { x: number; y: number; }

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
function initStyle(): string {
  try {
    const saved = localStorage.getItem('haha_style');
    return saved && STYLE_KEYS.includes(saved) ? saved : 'modern';
  } catch { return 'modern'; }
}

export interface ThemeValue {
  theme: Mode;
  toggle: (origin?: ThemeTransitionOrigin) => void;
  isDark: boolean;
  skin: string;
  setSkin: (s: string) => void;
  skins: Skin[];
  style: string;
  setStyle: (s: string) => void;
  styles: VisualStyle[];
}

const ThemeContext = createContext<ThemeValue | null>(null);

function applyThemeDom(theme: Mode, skin: string, style: string) {
  const el = document.documentElement;
  el.dataset.theme = theme;
  el.dataset.skin = skin;
  el.dataset.style = style;
  // HeroUI tailwind theme class (used by converted HeroUI components)
  el.classList.forEach((c) => { if (/-dark$/.test(c) || SKIN_KEYS.includes(c)) el.classList.remove(c); });
  el.classList.add(theme === 'dark' ? `${skin}-dark` : skin);
  try {
    localStorage.setItem('haha_theme', theme);
    localStorage.setItem('haha_skin', skin);
    localStorage.setItem('haha_style', style);
  } catch { /* storage may be unavailable */ }
  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
    || document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0d0f14' : '#ffffff');
}

export function ThemeProvider({ children }: { children?: ReactNode }) {
  const [theme, setTheme] = useState<Mode>(initMode);
  const [skin, setSkinState] = useState<string>(initSkin);
  const [style, setStyleState] = useState<string>(initStyle);

  useLayoutEffect(() => {
    applyThemeDom(theme, skin, style);
  }, [theme, skin, style]);

  const toggle = useCallback((origin?: ThemeTransitionOrigin) => {
    const next = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const x = Number.isFinite(origin?.x) ? origin!.x : window.innerWidth - 44;
    const y = Number.isFinite(origin?.y) ? origin!.y : 44;
    const radius = Math.ceil(Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)));
    const prepare = () => {
      root.classList.add('theme-soft-transition');
      root.style.setProperty('--theme-transition-x', `${x}px`);
      root.style.setProperty('--theme-transition-y', `${y}px`);
      root.style.setProperty('--theme-transition-radius', `${radius}px`);
    };
    const commit = () => { flushSync(() => setTheme(next)); };

    const startViewTransition = (document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    }).startViewTransition;

    if (!startViewTransition || reduceMotion) {
      prepare();
      commit();
      window.setTimeout(() => root.classList.remove('theme-soft-transition'), 460);
      return;
    }

    prepare();
    try {
      const transition = startViewTransition(commit);
      transition.finished.finally(() => {
        root.classList.remove('theme-soft-transition');
      });
    } catch {
      commit();
      window.setTimeout(() => root.classList.remove('theme-soft-transition'), 460);
    }
  }, [theme, skin, style]);
  const setSkin = useCallback((s: string) => { if (SKIN_KEYS.includes(s)) setSkinState(s); }, []);
  const setStyle = useCallback((s: string) => { if (STYLE_KEYS.includes(s)) setStyleState(s); }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle, isDark: theme === 'dark', skin, setSkin, skins: SKINS, style, setStyle, styles: STYLES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = (): ThemeValue => useContext(ThemeContext) as ThemeValue;

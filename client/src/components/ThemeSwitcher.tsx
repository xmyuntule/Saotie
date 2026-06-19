import { useState, useRef, useEffect } from 'react';
import Icon from './Icon';
import { useTheme } from '../context/ThemeContext';

// Appearance switcher: light/dark mode + HeroUI-Pro-style color skins.
export default function ThemeSwitcher() {
  const { theme, toggle, skin, setSkin, skins, style, setStyle, styles } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="theme-switch" ref={ref}>
      <button className="nav-icon-btn" onClick={() => setOpen((o) => !o)} aria-label="主题与配色" title="主题与配色">
        <Icon name="palette" size={20} />
      </button>
      {open && (
        <div className="ui-card theme-pop">
          <div className="ts-title">外观模式</div>
          <div className="ts-modes">
            <button className={`ts-mode${theme === 'light' ? ' on' : ''}`} onClick={() => theme !== 'light' && toggle()}>
              <Icon name="sun" size={15} /> 浅色
            </button>
            <button className={`ts-mode${theme === 'dark' ? ' on' : ''}`} onClick={() => theme !== 'dark' && toggle()}>
              <Icon name="moon" size={15} /> 深色
            </button>
          </div>
          <div className="ts-title">主题配色</div>
          <div className="ts-skins">
            {skins.map((s) => (
              <button key={s.key} className={`ts-skin${skin === s.key ? ' on' : ''}`} onClick={() => setSkin(s.key)} title={s.label}>
                <span className="ts-dot" style={{ background: s.color }}>{skin === s.key && <Icon name="check" size={12} />}</span>
                <span className="ts-label">{s.label}</span>
              </button>
            ))}
          </div>
          <div className="ts-title">视觉风格</div>
          <div className="ts-styles">
            {styles.map((st) => (
              <button key={st.key} className={`ts-style${style === st.key ? ' on' : ''}`} onClick={() => setStyle(st.key)}>
                <span className="ts-style-name">{st.label}{style === st.key && <Icon name="check" size={12} />}</span>
                <span className="ts-style-desc">{st.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

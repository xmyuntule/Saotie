import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../api/client';

// 站点外观自定义 (W) —— 站名 / 副标题 / Logo / 全站自定义 CSS。
// 公开接口 /api/site，未登录也能取，所以 Provider 放在最外层，登录页也能用自定义品牌。
export interface SiteConfig {
  name: string;
  slogan: string;
  logo: string;
  customCss: string;
}

const DEFAULTS: SiteConfig = { name: 'HahaSNS', slogan: '轻社交社区', logo: '', customCss: '' };

const SiteContext = createContext<SiteConfig>(DEFAULTS);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<SiteConfig>(DEFAULTS);

  useEffect(() => {
    let alive = true;
    api.get('/site')
      .then(({ data }) => { if (alive && data) setSite({ ...DEFAULTS, ...data }); })
      .catch(() => { /* 取不到就用内置默认，不阻塞首屏 */ });
    return () => { alive = false; };
  }, []);

  // 把自定义 CSS 注入 <head> 的专用 <style>，随配置变化更新；卸载时清理。
  useEffect(() => {
    const id = 'site-custom-css';
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!site.customCss) { if (el) el.textContent = ''; return; }
    if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
    el.textContent = site.customCss;
  }, [site.customCss]);

  return <SiteContext.Provider value={site}>{children}</SiteContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSite() { return useContext(SiteContext); }

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
  copyright?: string;
  icp?: string;
  publicSecurity?: string;
  footerHtml?: string;
  analyticsCode?: string;
  allowGuest: boolean;
  authHero?: {
    title?: string;
    subtitle?: string;
    points?: string;
    bgUrl?: string;
    bgType?: string;
  };
  modules: Record<string, boolean>; // 模块市场 (C)：模块开关；缺省视为开启
  layouts: Record<string, string>;  // 布局市场：每页布局 default|wide|narrow；缺省=各页内置默认
  sidebars: Record<string, string[]>; // 预留：每页右侧栏小组件 key 列表；缺省=内置默认
  payments?: { alipay?: boolean; wechat?: boolean; epay?: boolean }; // 已启用的支付网关（仅布尔，无密钥）
}

const DEFAULTS: SiteConfig = {
  name: 'SaotieSNS',
  slogan: '轻社交社区',
  logo: '',
  customCss: '',
  copyright: '',
  icp: '',
  publicSecurity: '',
  footerHtml: '',
  analyticsCode: '',
  allowGuest: true,
  authHero: {},
  modules: {},
  layouts: {},
  sidebars: {},
  payments: {},
};

// 模块是否开启：只有显式 false 才隐藏（取不到配置时默认全开，绝不误伤导航）
export function moduleOn(modules: Record<string, boolean> | undefined, key?: string) {
  if (!key) return true;
  return modules?.[key] !== false;
}

// 取某页的后台布局配置；站长未设置则用该页内置默认 fallback（零回归）。
export function pageLayoutOf(layouts: Record<string, string> | undefined, key: string, fallback: string) {
  return layouts?.[key] || fallback;
}

const SiteContext = createContext<SiteConfig>(DEFAULTS);

function injectHtml(id: string, html: string) {
  document.querySelectorAll(`[data-site-code="${id}"]`).forEach((n) => n.remove());
  if (!html.trim()) return;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  for (const node of Array.from(tpl.content.childNodes)) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    let next: Node;
    if (node.nodeName.toLowerCase() === 'script') {
      const old = node as HTMLScriptElement;
      const script = document.createElement('script');
      for (const attr of Array.from(old.attributes)) script.setAttribute(attr.name, attr.value);
      script.text = old.text || old.textContent || '';
      next = script;
    } else {
      next = node.cloneNode(true);
    }
    if (next instanceof HTMLElement) next.dataset.siteCode = id;
    document.head.appendChild(next);
  }
}

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

  useEffect(() => {
    injectHtml('site-analytics-code', site.analyticsCode || '');
    return () => document.querySelectorAll('[data-site-code="site-analytics-code"]').forEach((n) => n.remove());
  }, [site.analyticsCode]);

  return <SiteContext.Provider value={site}>{children}</SiteContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSite() { return useContext(SiteContext); }

// 便捷 hook：读取某页后台布局，未配置则回退到该页内置默认（'default'|'wide'|'narrow'）。
// eslint-disable-next-line react-refresh/only-export-components
export function useLayout(key: string, fallback: string = 'default') {
  return pageLayoutOf(useContext(SiteContext).layouts, key, fallback);
}

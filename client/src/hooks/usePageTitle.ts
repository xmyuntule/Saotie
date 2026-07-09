import { useEffect } from 'react';
import { useSite } from '../context/SiteContext';

type SeoKeywords = Array<string | null | undefined> | string;

interface SeoOptions {
  title?: string | null;
  description?: string | null;
  keywords?: SeoKeywords;
  image?: string | null;
  path?: string | null;
  type?: 'website' | 'article' | 'profile' | string;
}

const DEFAULT_DESCRIPTION = 'SaotieSNS 是轻社交、轻论坛、轻社区一体化社区平台，连接有趣的人与内容。';
const DEFAULT_KEYWORDS = ['SaotieSNS', 'Saotie', '轻社交', '社区', '论坛', '动态'];

export function cleanSeoText(input?: string | null) {
  return String(input || '')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>~|\\]/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateSeoText(input?: string | null, max = 100) {
  const text = cleanSeoText(input);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function buildKeywords(items: Array<string | null | undefined>, fallback = DEFAULT_KEYWORDS) {
  const source = items.length ? items : fallback;
  const seen = new Set<string>();
  const words: string[] = [];

  source
    .flatMap((item) => String(item || '').split(/[,，、#\s]+/))
    .map((item) => cleanSeoText(item))
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        words.push(item);
      }
    });

  return (words.length ? words : DEFAULT_KEYWORDS).join(',');
}

function ensureMeta(attr: 'name' | 'property', key: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  return el;
}

function setMeta(attr: 'name' | 'property', key: string, content?: string | null) {
  const value = cleanSeoText(content);
  if (!value) return;
  ensureMeta(attr, key).setAttribute('content', value);
}

function setCanonical(href?: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

function absoluteUrl(url?: string | null) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `${window.location.protocol}${url}`;
  if (url.startsWith('/')) return `${window.location.origin}${url}`;
  return url;
}

function normalizeKeywords(keywords?: SeoKeywords) {
  if (typeof keywords === 'string') return buildKeywords(keywords.split(','), DEFAULT_KEYWORDS);
  return buildKeywords(keywords || DEFAULT_KEYWORDS, DEFAULT_KEYWORDS);
}

/**
 * 动态详情页（文章/问答/活动等）数据到位后，把浏览器标签标题设为真实内容标题，
 * 覆盖 Layout 按路由设的通用标题（如「文章」「活动详情」）——让标签页 / 历史 / 分享更可辨。
 * 传空（数据尚未加载或无标题）则不动，保留 Layout 的通用标题；离开页面时 Layout 按新路由重置。
 */
export function usePageTitle(title?: string | null) {
  const site = useSite();
  useEffect(() => {
    if (!title) return;
    document.title = `${title} · ${site.name}`;
  }, [title, site.name]);
}

export function useSeo(options: SeoOptions) {
  const site = useSite();
  const keywordKey = Array.isArray(options.keywords) ? options.keywords.join('|') : options.keywords;

  useEffect(() => {
    const siteName = cleanSeoText(site.name) || 'SaotieSNS';
    const coreTitle = truncateSeoText(options.title || siteName, 64) || siteName;
    const title = coreTitle.includes(siteName) ? coreTitle : `${coreTitle} · ${siteName}`;
    const description = truncateSeoText(options.description || site.slogan || DEFAULT_DESCRIPTION, 120);
    const keywords = normalizeKeywords(options.keywords);
    const canonical = `${window.location.origin}${options.path || window.location.pathname}`;
    const image = absoluteUrl(options.image);

    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'keywords', keywords);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', options.type || 'website');
    setMeta('property', 'og:url', canonical);
    setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    if (image) {
      setMeta('property', 'og:image', image);
      setMeta('name', 'twitter:image', image);
    }
    setCanonical(canonical);

    return () => {
      setMeta('name', 'description', site.slogan || DEFAULT_DESCRIPTION);
      setMeta('name', 'keywords', DEFAULT_KEYWORDS.join(','));
    };
  }, [keywordKey, options.description, options.image, options.path, options.title, options.type, site.name, site.slogan]);
}

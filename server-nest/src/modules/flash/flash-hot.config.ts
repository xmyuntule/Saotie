export const FLASH_HOT_SOURCES_KEY = 'flash_hot_sources';

export type FlashHotSourceKind = 'baidu' | 'zhihu' | 'toutiao' | 'json' | 'rss';
export type FlashHotDisplay = 'list' | 'compact';

export interface FlashHotSourceConfig {
  key: string;
  name: string;
  kind: FlashHotSourceKind;
  apiUrl: string;
  home?: string;
  description?: string;
  itemPath?: string;
  enabled: boolean;
  limit: number;
  refreshMinutes: number;
  display: FlashHotDisplay;
}

const KIND_VALUES = ['baidu', 'zhihu', 'toutiao', 'json', 'rss'];
const DISPLAY_VALUES = ['list', 'compact'];

const BUILTIN_URLS: Record<string, string> = {
  baidu: 'https://top.baidu.com/board?tab=realtime',
  zhihu: 'https://www.zhihu.com/api/v3/feed/topstory/hot-list-web?limit=20&desktop=true',
  toutiao: 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc',
};

export const DEFAULT_FLASH_HOT_SOURCES: FlashHotSourceConfig[] = [
  {
    key: 'baidu',
    name: '百度',
    kind: 'baidu',
    apiUrl: BUILTIN_URLS.baidu,
    home: 'https://top.baidu.com',
    enabled: true,
    limit: 20,
    refreshMinutes: 1440,
    display: 'list',
  },
  {
    key: 'zhihu',
    name: '知乎',
    kind: 'zhihu',
    apiUrl: BUILTIN_URLS.zhihu,
    home: 'https://www.zhihu.com',
    enabled: true,
    limit: 20,
    refreshMinutes: 1440,
    display: 'list',
  },
  {
    key: 'toutiao',
    name: '头条',
    kind: 'toutiao',
    apiUrl: BUILTIN_URLS.toutiao,
    home: 'https://www.toutiao.com',
    enabled: true,
    limit: 20,
    refreshMinutes: 1440,
    display: 'list',
  },
];

function clampInt(value: any, fallback: number, min: number, max: number) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function cleanKey(raw: any, fallback: string) {
  const base = String(raw || fallback || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (base || 'source').slice(0, 32);
}

function cleanString(raw: any, max: number) {
  return String(raw ?? '').trim().slice(0, max);
}

function cleanKind(raw: any): FlashHotSourceKind {
  const value = String(raw || 'json').trim().toLowerCase();
  return KIND_VALUES.includes(value) ? (value as FlashHotSourceKind) : 'json';
}

function cleanDisplay(raw: any): FlashHotDisplay {
  const value = String(raw || 'list').trim().toLowerCase();
  return DISPLAY_VALUES.includes(value) ? (value as FlashHotDisplay) : 'list';
}

function parseRawSources(raw: any): any[] | null {
  if (raw == null || raw === '') return null;
  let value = raw;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return null;
    value = JSON.parse(text);
  }
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray(value.sources)) return value.sources;
  throw new Error('flash_hot_sources must be a JSON array');
}

export function normalizeFlashHotSources(
  raw: any,
  options: { fallbackToDefault?: boolean } = {},
): FlashHotSourceConfig[] {
  const fallbackToDefault = options.fallbackToDefault !== false;
  const rawList = parseRawSources(raw);
  const list = rawList || (fallbackToDefault ? DEFAULT_FLASH_HOT_SOURCES : []);
  const seen = new Set<string>();
  return list.slice(0, 20).map((item, index) => {
    const kind = cleanKind(item?.kind || item?.type || item?.source);
    const key = cleanKey(item?.key || item?.id, `${kind}-${index + 1}`);
    if (seen.has(key)) throw new Error(`duplicate flash hot source key: ${key}`);
    seen.add(key);
    const builtinUrl = BUILTIN_URLS[kind] || '';
    const apiUrl = cleanString(item?.apiUrl || item?.url || builtinUrl, 700);
    if (!apiUrl) throw new Error(`flash hot source ${key} needs apiUrl`);
    return {
      key,
      name: cleanString(item?.name || item?.label || key, 32) || key,
      kind,
      apiUrl,
      home: cleanString(item?.home, 300),
      description: cleanString(item?.description || item?.desc, 160),
      itemPath: cleanString(item?.itemPath || item?.path, 120),
      enabled: item?.enabled !== false && item?.disabled !== true,
      limit: clampInt(item?.limit, 20, 5, 50),
      refreshMinutes: clampInt(item?.refreshMinutes ?? item?.ttlMinutes, 1440, 1, 10080),
      display: cleanDisplay(item?.display || item?.displayMode),
    };
  });
}

export function serializeFlashHotSources(raw: any) {
  return JSON.stringify(
    normalizeFlashHotSources(raw, { fallbackToDefault: false }),
    null,
    2,
  );
}

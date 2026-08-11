import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { XMLParser } from 'fast-xml-parser';
import { Repository } from 'typeorm';
import { Flash, User } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { SiteService } from '../site/site.service';
import { CreateFlashDto } from './dto/flash.dto';
import {
  FLASH_HOT_SOURCES_KEY,
  DEFAULT_FLASH_HOT_SOURCES,
  FlashHotSourceConfig,
  normalizeFlashHotSources,
} from './flash-hot.config';

type HotStatus = 'success' | 'cache' | 'error';

export interface FlashHotItem {
  id: string;
  rank: number;
  title: string;
  url: string;
  summary?: string;
  hot?: string;
  image?: string;
}

export type FlashHotPublicSource = Pick<
  FlashHotSourceConfig,
  'key' | 'name' | 'kind' | 'home' | 'description' | 'limit' | 'refreshMinutes' | 'display' | 'enabled'
>;

export interface FlashHotResponse {
  status: HotStatus;
  source: FlashHotPublicSource;
  updatedAt: number;
  items: FlashHotItem[];
  error: string;
  cooldown: boolean;
}

interface FlashHotCache {
  sourceKey: string;
  signature: string;
  updatedAt: number;
  items: FlashHotItem[];
}

const HOT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FORCE_REFRESH_COOLDOWN_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 9000;

/**
 * Ported from server/src/routes/flash.js. 资讯快报 / 公告 news feed (public list,
 * admin publish). Response shapes match the Express version.
 */
@Injectable()
export class FlashService {
  private readonly hotLocks = new Map<string, Promise<FlashHotCache>>();

  constructor(
    @InjectRepository(Flash) private readonly flash: Repository<Flash>,
    private readonly helpers: HelpersService,
    private readonly site: SiteService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private mapRow(r: Flash) {
    return {
      id: r.id,
      title: r.title,
      summary: r.summary,
      category: r.category,
      url: r.url,
      pinned: r.pinned,
      createdAt: r.created_at,
    };
  }

  private async hotSourcesConfig() {
    const raw = await this.site.getConfig(FLASH_HOT_SOURCES_KEY);
    try {
      return normalizeFlashHotSources(raw, { fallbackToDefault: true });
    } catch {
      return DEFAULT_FLASH_HOT_SOURCES;
    }
  }

  private publicSource(source: FlashHotSourceConfig): FlashHotPublicSource {
    return {
      key: source.key,
      name: source.name,
      kind: source.kind,
      home: source.home || '',
      description: source.description || '',
      limit: source.limit,
      refreshMinutes: source.refreshMinutes,
      display: source.display,
      enabled: source.enabled,
    };
  }

  async hotSources(includeDisabled = false) {
    const sources = await this.hotSourcesConfig();
    return {
      sources: sources
        .filter((s) => includeDisabled || s.enabled)
        .map((s) => this.publicSource(s)),
    };
  }

  private cacheKey(sourceKey: string) {
    return `flash:hot:${sourceKey}`;
  }

  private sourceSignature(source: FlashHotSourceConfig) {
    return JSON.stringify({
      kind: source.kind,
      apiUrl: source.apiUrl,
      itemPath: source.itemPath || '',
      limit: source.limit,
      display: source.display,
    });
  }

  private hotResponse(
    source: FlashHotSourceConfig,
    cache: FlashHotCache | null,
    status: HotStatus,
    error = '',
    cooldown = false,
  ): FlashHotResponse {
    return {
      status,
      source: this.publicSource(source),
      updatedAt: cache?.updatedAt || 0,
      items: cache?.items || [],
      error,
      cooldown,
    };
  }

  async hotList(sourceKey: string, force = false): Promise<FlashHotResponse> {
    const sources = await this.hotSourcesConfig();
    const source = sources.find((s) => s.key === sourceKey && s.enabled);
    if (!source) throw new NotFoundException('热榜来源不存在或未启用');

    const key = this.cacheKey(source.key);
    const now = Date.now();
    const cached = ((await this.cache.get(key)) || null) as FlashHotCache | null;
    const signature = this.sourceSignature(source);
    const signatureMatch = cached?.signature === signature;
    const fresh =
      cached && signatureMatch && now - Number(cached.updatedAt || 0) < source.refreshMinutes * 60 * 1000;
    if (cached && fresh && !force) return this.hotResponse(source, cached, 'cache');
    if (force && cached && now - Number(cached.updatedAt || 0) < FORCE_REFRESH_COOLDOWN_MS) {
      return this.hotResponse(source, cached, 'cache', '', true);
    }

    let pending = this.hotLocks.get(source.key);
    if (!pending) {
      pending = this.fetchHotSource(source).finally(() => this.hotLocks.delete(source.key));
      this.hotLocks.set(source.key, pending);
    }

    try {
      const next = await pending;
      await this.cache.set(key, { ...next, signature }, HOT_CACHE_TTL_MS);
      return this.hotResponse(source, next, 'success');
    } catch (err: any) {
      if (cached?.items?.length) {
        return this.hotResponse(source, cached, 'cache', err?.message || '热榜刷新失败');
      }
      return this.hotResponse(
        source,
        { sourceKey: source.key, signature, updatedAt: 0, items: [] },
        'error',
        err?.message || '热榜刷新失败',
      );
    }
  }

  async refreshHot(sourceKey: string): Promise<FlashHotResponse> {
    return this.hotList(sourceKey, true);
  }

  private async fetchHotSource(source: FlashHotSourceConfig): Promise<FlashHotCache> {
    let items: FlashHotItem[] = [];
    if (source.kind === 'baidu') items = await this.fetchBaidu(source);
    else if (source.kind === 'zhihu') items = await this.fetchZhihu(source);
    else if (source.kind === 'toutiao') items = await this.fetchToutiao(source);
    else if (source.kind === 'rss') items = await this.fetchRss(source);
    else items = await this.fetchGenericJson(source);

    const clean = items
      .filter((item) => item.title)
      .slice(0, source.limit)
      .map((item, index) => ({ ...item, rank: index + 1 }));
    if (!clean.length) throw new BadRequestException('热榜来源没有返回有效条目');
    return { sourceKey: source.key, signature: this.sourceSignature(source), updatedAt: Date.now(), items: clean };
  }

  private async fetchBaidu(source: FlashHotSourceConfig) {
    const html = await this.fetchText(source.apiUrl, 'text/html,application/xhtml+xml');
    const jsonMatch = html.match(/<!--s-data:(.*?)-->/s);
    if (!jsonMatch) throw new BadRequestException('百度热榜页面结构已变化');
    const parsed = JSON.parse(jsonMatch[1]);
    const rows = this.readPath(parsed, 'data.cards.0.content');
    return this.asArray(rows)
      .filter((row) => !row?.isTop)
      .map((row, index) => this.makeItem(source, {
        id: row?.rawUrl || row?.word,
        title: row?.word,
        url: row?.rawUrl,
        summary: row?.desc,
      }, index))
      .filter(Boolean) as FlashHotItem[];
  }

  private async fetchZhihu(source: FlashHotSourceConfig) {
    const data = await this.fetchJson(source.apiUrl);
    return this.asArray(data?.data).map((row, index) => {
      const target = row?.target || {};
      return this.makeItem(source, {
        id: this.readString(target, ['link.url']) || this.readString(row, ['id']),
        title: this.readString(target, ['title_area.text', 'title']),
        url: this.readString(target, ['link.url']),
        summary: this.readString(target, ['excerpt_area.text']),
        hot: this.readString(target, ['metrics_area.text']),
        image: this.readString(target, ['image_area.url']),
      }, index);
    }).filter(Boolean) as FlashHotItem[];
  }

  private async fetchToutiao(source: FlashHotSourceConfig) {
    const data = await this.fetchJson(source.apiUrl);
    return this.asArray(data?.data).map((row, index) => {
      const id = this.readString(row, ['ClusterIdStr', 'id']);
      return this.makeItem(source, {
        id,
        title: this.readString(row, ['Title', 'title']),
        url: id ? `https://www.toutiao.com/trending/${id}/` : this.readString(row, ['url', 'link']),
        hot: this.readString(row, ['HotValue', 'hotValue', 'hot']),
        image: this.readString(row, ['Image.url', 'image.url', 'image']),
      }, index);
    }).filter(Boolean) as FlashHotItem[];
  }

  private async fetchGenericJson(source: FlashHotSourceConfig) {
    const data = await this.fetchJson(source.apiUrl);
    const rows = this.extractArray(data, source.itemPath);
    return rows
      .map((row, index) => this.makeItem(source, {
        id: this.readString(row, ['id', 'key', 'uid', 'url', 'link', 'rawUrl']),
        title: this.readString(row, [
          'title',
          'name',
          'word',
          'text',
          'sentence',
          'keyword',
          'Title',
          'target.title_area.text',
        ]),
        url: this.readString(row, [
          'url',
          'link',
          'rawUrl',
          'mobileUrl',
          'href',
          'sourceUrl',
          'target.link.url',
        ]),
        summary: this.readString(row, [
          'summary',
          'desc',
          'description',
          'excerpt',
          'digest',
          'target.excerpt_area.text',
        ]),
        hot: this.readString(row, [
          'hot',
          'hotValue',
          'HotValue',
          'score',
          'metrics',
          'target.metrics_area.text',
        ]),
        image: this.readString(row, [
          'image',
          'cover',
          'pic',
          'thumbnail',
          'image.url',
          'Image.url',
          'target.image_area.url',
        ]),
      }, index))
      .filter(Boolean) as FlashHotItem[];
  }

  private async fetchRss(source: FlashHotSourceConfig) {
    const xml = await this.fetchText(source.apiUrl, 'application/rss+xml,application/atom+xml,text/xml');
    const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(xml);
    const rows =
      this.asArray(this.readPath(parsed, 'rss.channel.item')).length
        ? this.asArray(this.readPath(parsed, 'rss.channel.item'))
        : this.asArray(this.readPath(parsed, 'feed.entry'));
    return rows
      .map((row, index) => this.makeItem(source, {
        id: this.readString(row, ['guid', 'id', 'link']),
        title: this.readString(row, ['title']),
        url: this.readRssUrl(row),
        summary: this.readString(row, ['description', 'summary', 'content', 'content:encoded']),
      }, index))
      .filter(Boolean) as FlashHotItem[];
  }

  private readRssUrl(row: any) {
    const direct = this.readString(row, ['link']);
    if (direct) return direct;
    const link = Array.isArray(row?.link) ? row.link[0] : row?.link;
    if (typeof link === 'object') return String(link?.['@_href'] || link?.href || '');
    return '';
  }

  private async fetchJson(url: string) {
    return JSON.parse(await this.fetchText(url, 'application/json,text/plain'));
  }

  private async fetchText(rawUrl: string, accept: string) {
    const url = this.assertPublicHttpUrl(rawUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          accept,
          'user-agent':
            'Mozilla/5.0 (compatible; SaotieBot/1.0; +https://saotie.com)',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  private assertPublicHttpUrl(raw: string) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException('热榜 API URL 无效');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException('热榜 API 仅支持 http/https');
    }
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '::1' ||
      host.includes(':')
    ) {
      throw new BadRequestException('热榜 API 不允许访问内网地址');
    }
    const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4) {
      const nums = ipv4.slice(1).map(Number);
      const [a, b] = nums;
      if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
      ) {
        throw new BadRequestException('热榜 API 不允许访问内网地址');
      }
    }
    return url;
  }

  private extractArray(data: any, itemPath?: string) {
    if (itemPath) return this.asArray(this.readPath(data, itemPath));
    if (Array.isArray(data)) return data;
    const candidates = [
      'items',
      'data.items',
      'data.list',
      'data.result',
      'data.results',
      'data.word_list',
      'data.cards.0.content',
      'data',
      'result',
      'results',
      'list',
      'newslist',
      'word_list',
    ];
    for (const path of candidates) {
      const value = this.readPath(data, path);
      if (Array.isArray(value)) return value;
    }
    return [];
  }

  private asArray(value: any) {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
  }

  private makeItem(
    source: FlashHotSourceConfig,
    raw: {
      id?: any;
      title?: any;
      url?: any;
      summary?: any;
      hot?: any;
      image?: any;
    },
    index: number,
  ): FlashHotItem | null {
    const title = this.cleanText(raw.title, 160);
    if (!title) return null;
    const url = this.resolveExternalUrl(raw.url, source);
    const image = this.resolveExternalUrl(raw.image, source);
    return {
      id: this.cleanText(raw.id, 180) || url || `${source.key}:${index + 1}:${title}`,
      rank: index + 1,
      title,
      url,
      summary: this.cleanText(raw.summary, 220),
      hot: this.cleanText(raw.hot, 60),
      image,
    };
  }

  private cleanText(value: any, max: number) {
    return String(value ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  private resolveExternalUrl(raw: any, source: FlashHotSourceConfig) {
    const value = String(raw ?? '').trim();
    if (!value) return '';
    try {
      const base = source.home || source.apiUrl;
      const url = new URL(value, base);
      return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
    } catch {
      return '';
    }
  }

  private readString(obj: any, paths: string[]) {
    for (const path of paths) {
      const value = this.readPath(obj, path);
      if (typeof value === 'string' || typeof value === 'number') {
        const text = String(value).trim();
        if (text) return text;
      }
    }
    return '';
  }

  private readPath(obj: any, path: string) {
    if (!path) return undefined;
    return path
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .filter(Boolean)
      .reduce((current, key) => (current == null ? undefined : current[key]), obj);
  }

  // ---- GET /api/flash ----
  async list(rawLimit: any, category: string | undefined, q?: string) {
    const limit = Math.min(50, Math.max(1, Number(rawLimit) || 30));
    let qb = this.flash.createQueryBuilder('f');
    if (category) qb = qb.where('f.category = :category', { category });
    const term = (q || '').trim();
    if (term) {
      const like = `%${term}%`;
      qb = category ? qb.andWhere('f.title LIKE :like', { like }) : qb.where('f.title LIKE :like', { like });
    }
    const rows = await qb
      .orderBy('f.pinned', 'DESC')
      .addOrderBy('f.created_at', 'DESC')
      .limit(limit)
      .getMany();
    return { flash: rows.map((r) => this.mapRow(r)) };
  }

  // ---- POST /api/flash ----
  async create(user: User, dto: CreateFlashDto) {
    this.helpers.requireAdmin(user);
    const title = (dto.title || '').trim();
    const summary = dto.summary || '';
    const category = dto.category || '动态';
    const url = dto.url || '';
    if (!title) throw new BadRequestException('标题必填');
    const saved = await this.flash.save(
      this.flash.create({
        title: title.slice(0, 120),
        summary: summary.slice(0, 300),
        category,
        url: url.slice(0, 300),
        pinned: dto.pinned ? 1 : 0,
        created_at: this.helpers.nowSql(),
      }),
    );
    return { ok: true, id: saved.id };
  }

  // ---- PUT /api/flash/:id （仅管理员，编辑标题/摘要/分类/链接/置顶）----
  async update(user: User, id: number, dto: CreateFlashDto) {
    this.helpers.requireAdmin(user);
    const f = await this.flash.findOne({ where: { id } });
    if (!f) throw new NotFoundException('快报不存在');
    const patch: Partial<Flash> = {};
    if (dto.title != null) {
      const t = dto.title.trim();
      if (!t) throw new BadRequestException('标题必填');
      patch.title = t.slice(0, 120);
    }
    if (dto.summary != null) patch.summary = dto.summary.slice(0, 300);
    if (dto.category != null) patch.category = dto.category;
    if (dto.url != null) patch.url = dto.url.slice(0, 300);
    if (dto.pinned !== undefined) patch.pinned = dto.pinned ? 1 : 0;
    if (Object.keys(patch).length) await this.flash.update({ id }, patch);
    return { ok: true };
  }

  // ---- DELETE /api/flash/:id （仅管理员）----
  async remove(user: User, id: number) {
    this.helpers.requireAdmin(user);
    await this.flash.delete({ id });
    return { ok: true };
  }
}

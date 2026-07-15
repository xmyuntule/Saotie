import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { basename, extname } from 'node:path';
import { DataSource, In, Repository } from 'typeorm';
import { XMLParser } from 'fast-xml-parser';
import { HelpersService } from '../../common/helpers.service';
import {
  Board,
  ExternalSyncImport,
  ExternalSyncSource,
  Thread,
  User,
} from '../../database/entities';
import { SiteService } from '../site/site.service';
import { StorageService } from '../storage/storage.service';
import { UpsertExternalSyncSourceDto } from './dto';

const DEFAULT_TEMPLATE = '{title}\n\n{summary}\n\n原文：{sourceUrl}';
const FEED_LIMIT_BYTES = 3 * 1024 * 1024;
const IMAGE_LIMIT_BYTES = 5 * 1024 * 1024;

type FeedItem = {
  title: string;
  link: string;
  guid: string;
  html: string;
  summary: string;
  content: string;
  images: string[];
};

@Injectable()
export class ExternalSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExternalSyncService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(ExternalSyncSource)
    private readonly sources: Repository<ExternalSyncSource>,
    @InjectRepository(ExternalSyncImport)
    private readonly imports: Repository<ExternalSyncImport>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Board) private readonly boards: Repository<Board>,
    @InjectRepository(Thread) private readonly threads: Repository<Thread>,
    private readonly dataSource: DataSource,
    private readonly helpers: HelpersService,
    private readonly site: SiteService,
    private readonly storage: StorageService,
  ) {}

  async onModuleInit() {
    await this.ensureSchema().catch((e) =>
      this.logger.error(`External sync schema init failed: ${e?.message || e}`),
    );
    this.timer = setInterval(() => {
      this.runDueSources().catch((e) =>
        this.logger.warn(`External sync run failed: ${e?.message || e}`),
      );
    }, 10 * 60 * 1000);
    this.timer.unref?.();
    const first = setTimeout(() => {
      this.runDueSources().catch((e) =>
        this.logger.warn(`External sync first run failed: ${e?.message || e}`),
      );
    }, 60 * 1000);
    first.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async adminIndex() {
    const [sources, imports, boards] = await Promise.all([
      this.sources.find({ order: { id: 'DESC' } }),
      this.imports.find({ order: { id: 'DESC' }, take: 40 }),
      this.boards.find({ order: { sort: 'ASC', id: 'ASC' } }),
    ]);
    const userIds = [
      ...new Set([
        ...sources.map((s) => s.user_id),
        ...imports.map((i) => sources.find((s) => s.id === i.source_id)?.user_id),
      ].filter(Boolean) as number[]),
    ];
    const boardMap = new Map(boards.map((b) => [b.id, b]));
    const users = userIds.length
      ? await this.users.find({ where: { id: In(userIds) } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const sourceMap = new Map(sources.map((s) => [s.id, s]));
    return {
      sources: sources.map((s) => this.presentSource(s, userMap, boardMap)),
      imports: imports.map((i) => {
        const source = sourceMap.get(i.source_id);
        return {
          id: i.id,
          sourceId: i.source_id,
          sourceName: source?.name || `#${i.source_id}`,
          title: i.title,
          sourceUrl: i.source_url,
          status: i.status,
          threadId: i.thread_id,
          error: i.error,
          createdAt: i.created_at,
        };
      }),
      boards: boards.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        parentId: b.parent_id,
      })),
      defaultTemplate: DEFAULT_TEMPLATE,
    };
  }

  async createSource(adminId: number, dto: UpsertExternalSyncSourceDto) {
    const data = await this.normalizeSourceDto(dto);
    const now = this.helpers.nowSql();
    const row = await this.sources.save(
      this.sources.create({
        ...data,
        created_at: now,
        updated_at: now,
        last_fetched_at: null,
      }),
    );
    await this.helpers.logAdmin(adminId, 'external_sync.create', {
      targetType: 'external_sync_source',
      targetId: row.id,
      detail: `新增站外同步源：${row.name}`,
    });
    return { source: row };
  }

  async updateSource(
    adminId: number,
    id: number,
    dto: UpsertExternalSyncSourceDto,
  ) {
    const source = await this.sources.findOne({ where: { id } });
    if (!source) throw new NotFoundException('订阅源不存在');
    const data = await this.normalizeSourceDto(dto);
    Object.assign(source, data, { updated_at: this.helpers.nowSql() });
    const row = await this.sources.save(source);
    await this.helpers.logAdmin(adminId, 'external_sync.update', {
      targetType: 'external_sync_source',
      targetId: row.id,
      detail: `更新站外同步源：${row.name}`,
    });
    return { source: row };
  }

  async deleteSource(adminId: number, id: number) {
    const source = await this.sources.findOne({ where: { id } });
    if (!source) throw new NotFoundException('订阅源不存在');
    await this.imports.delete({ source_id: id });
    await this.sources.delete({ id });
    await this.helpers.logAdmin(adminId, 'external_sync.delete', {
      targetType: 'external_sync_source',
      targetId: id,
      detail: `删除站外同步源：${source.name}`,
    });
    return { ok: true };
  }

  async fetchSourceNow(id: number) {
    const source = await this.sources.findOne({ where: { id } });
    if (!source) throw new NotFoundException('订阅源不存在');
    return this.fetchSource(source, true);
  }

  private async runDueSources() {
    if (this.running) return;
    if (!(await this.globalEnabled())) return;
    this.running = true;
    try {
      const rows = await this.sources.find({ where: { enabled: 1 } });
      const now = Date.now();
      for (const source of rows) {
        const intervalMs =
          Math.max(10, Number(source.fetch_interval_min) || 60) * 60 * 1000;
        const last = this.parseSqlTime(source.last_fetched_at);
        if (!last || now - last >= intervalMs) {
          await this.fetchSource(source, false).catch((e) =>
            this.logger.warn(
              `Source #${source.id} (${source.name}) failed: ${e?.message || e}`,
            ),
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async fetchSource(source: ExternalSyncSource, manual: boolean) {
    if (!(await this.globalEnabled())) {
      throw new BadRequestException('请先在后台开启站外同步');
    }
    if (!source.enabled && !manual) {
      return { ok: true, imported: 0, skipped: 0, failed: 0 };
    }
    const [user, board] = await Promise.all([
      this.users.findOne({ where: { id: source.user_id } }),
      this.boards.findOne({ where: { id: source.board_id } }),
    ]);
    if (!user) throw new BadRequestException('绑定用户不存在');
    if (!board) throw new BadRequestException('绑定板块不存在');
    await this.assertUserCanImport(user);

    const maxItems = await this.configNumber(
      'external_sync_max_items_per_fetch',
      5,
      1,
      20,
    );
    const cost = await this.configNumber('external_sync_cost_per_post', 0, 0, 100000);
    const xml = await this.fetchText(source.rss_url);
    const items = this.parseFeed(xml, source.rss_url).slice(0, maxItems);
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of items) {
      const hash = this.itemHash(source.id, item);
      const exists = await this.imports.findOne({
        where: { source_id: source.id, source_hash: hash },
      });
      if (exists) {
        skipped++;
        continue;
      }
      try {
        await this.publishItem(source, user, item, hash, cost);
        imported++;
      } catch (e: any) {
        failed++;
        const msg = e?.message || '导入失败';
        errors.push(`${item.title || item.link || '未命名'}：${msg}`);
        if (msg.includes('积分不足')) break;
      }
    }

    source.last_fetched_at = this.helpers.nowSql();
    source.updated_at = source.last_fetched_at;
    await this.sources.save(source);
    return { ok: true, imported, skipped, failed, errors };
  }

  private async publishItem(
    source: ExternalSyncSource,
    user: User,
    item: FeedItem,
    hash: string,
    cost: number,
  ) {
    if (cost > 0) {
      const fresh = await this.users.findOne({ where: { id: user.id } });
      if (!fresh || (fresh.points || 0) < cost) {
        throw new BadRequestException('绑定用户积分不足');
      }
    }
    const media = await this.localizeImages(
      item.images,
      Math.max(0, Math.min(9, Number(source.max_images) || 0)),
    );
    const now = this.helpers.nowSql();
    const title = this.limitText(item.title || '站外同步内容', 180);
    const content = this.limitText(
      this.renderTemplate(source.template || DEFAULT_TEMPLATE, item),
      6000,
    );

    await this.dataSource.transaction(async (manager) => {
      if (cost > 0) {
        const debit = await manager
          .createQueryBuilder()
          .update(User)
          .set({ points: () => `points - ${cost}` })
          .where('id = :id AND points >= :cost', { id: user.id, cost })
          .execute();
        if (!debit.affected) {
          throw new BadRequestException('绑定用户积分不足');
        }
      }
      const thread = await manager.getRepository(Thread).save(
        manager.getRepository(Thread).create({
          board_id: source.board_id,
          user_id: user.id,
          title,
          content,
          media: JSON.stringify(media),
          created_at: now,
          last_reply_at: now,
        }),
      );
      await manager
        .getRepository(Board)
        .increment({ id: source.board_id }, 'thread_count', 1);
      await manager.getRepository(ExternalSyncImport).save(
        manager.getRepository(ExternalSyncImport).create({
          source_id: source.id,
          source_url: item.link,
          source_guid: this.limitText(item.guid || item.link || item.title, 255),
          source_hash: hash,
          title,
          status: 'published',
          thread_id: thread.id,
          error: '',
          created_at: now,
        }),
      );
    });
  }

  private async normalizeSourceDto(dto: UpsertExternalSyncSourceDto) {
    const rssUrl = String(dto.rssUrl || '').trim();
    this.assertHttpUrl(rssUrl);
    const userId = Math.round(Number(dto.userId));
    const boardId = Math.round(Number(dto.boardId));
    const [user, board] = await Promise.all([
      this.users.findOne({ where: { id: userId } }),
      this.boards.findOne({ where: { id: boardId } }),
    ]);
    if (!user) throw new BadRequestException('绑定用户不存在');
    if (!board) throw new BadRequestException('绑定板块不存在');
    return {
      user_id: userId,
      board_id: boardId,
      name: this.limitText(String(dto.name || '').trim(), 120) || 'RSS 订阅源',
      rss_url: rssUrl,
      template: String(dto.template || DEFAULT_TEMPLATE).slice(0, 2000),
      enabled: dto.enabled === false ? 0 : 1,
      auto_publish: 1,
      max_images: Math.max(0, Math.min(9, Math.round(Number(dto.maxImages ?? 3)))),
      fetch_interval_min: Math.max(
        10,
        Math.min(1440, Math.round(Number(dto.fetchIntervalMin ?? 60))),
      ),
    };
  }

  private presentSource(
    source: ExternalSyncSource,
    userMap: Map<number, User>,
    boardMap: Map<number, Board>,
  ) {
    const user = userMap.get(source.user_id);
    const board = boardMap.get(source.board_id);
    return {
      id: source.id,
      name: source.name,
      rssUrl: source.rss_url,
      userId: source.user_id,
      userNickname: user?.nickname || user?.username || `#${source.user_id}`,
      boardId: source.board_id,
      boardName: board?.name || `#${source.board_id}`,
      template: source.template || DEFAULT_TEMPLATE,
      enabled: !!source.enabled,
      maxImages: source.max_images,
      fetchIntervalMin: source.fetch_interval_min,
      lastFetchedAt: source.last_fetched_at,
      createdAt: source.created_at,
      updatedAt: source.updated_at,
    };
  }

  private async assertUserCanImport(user: User) {
    if (user.banned) throw new BadRequestException('绑定用户已被封禁');
    const group = String(
      await this.site.getConfig('external_sync_allowed_group', 'admin'),
    );
    if (group === 'admin' && user.role !== 'admin') {
      throw new BadRequestException('当前配置仅允许管理员账号同步');
    }
    if (group === 'vip' && user.role !== 'admin' && !user.vip) {
      throw new BadRequestException('当前配置仅允许 VIP 或管理员账号同步');
    }
    const minLevel = await this.configNumber('external_sync_min_level', 0, 0, 60);
    if (
      minLevel > 0 &&
      user.role !== 'admin' &&
      this.helpers.levelFromExp(user.experience || 0) < minLevel
    ) {
      throw new BadRequestException(`绑定用户等级不足，至少需要 Lv.${minLevel}`);
    }
  }

  private async globalEnabled() {
    return (await this.site.getConfig('external_sync_enabled', '0')) === '1';
  }

  private async configNumber(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ) {
    const raw = await this.site.getConfig(key, String(fallback));
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  private async fetchText(url: string) {
    const res = await this.safeFetch(url, 15000);
    const len = Number(res.headers.get('content-length') || 0);
    if (len > FEED_LIMIT_BYTES) throw new BadRequestException('RSS 内容过大');
    const text = await res.text();
    if (Buffer.byteLength(text) > FEED_LIMIT_BYTES) {
      throw new BadRequestException('RSS 内容过大');
    }
    return text;
  }

  private async localizeImages(urls: string[], maxImages: number) {
    const out: { url: string; type: string; name: string }[] = [];
    for (const url of [...new Set(urls)].slice(0, maxImages)) {
      try {
        const res = await this.safeFetch(url, 15000);
        const mimetype = (res.headers.get('content-type') || '')
          .split(';')[0]
          .trim()
          .toLowerCase();
        if (!mimetype.startsWith('image/')) continue;
        const buffer = await this.readLimitedBuffer(res, IMAGE_LIMIT_BYTES);
        const uploaded = await this.storage.upload({
          buffer,
          originalname: this.imageNameFromUrl(res.url || url, mimetype),
          mimetype,
        });
        out.push({
          url: uploaded.url,
          type: uploaded.type,
          name: uploaded.name,
        });
      } catch (e: any) {
        this.logger.warn(`Image localization skipped: ${e?.message || e}`);
      }
    }
    return out;
  }

  private async safeFetch(url: string, timeoutMs: number) {
    await this.assertPublicHttpUrl(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'user-agent': 'SaotieSNS ExternalSync/1.0',
          accept: '*/*',
        },
      });
      await this.assertPublicHttpUrl(res.url);
      if (!res.ok) throw new BadRequestException(`请求失败：HTTP ${res.status}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  private async readLimitedBuffer(res: Response, maxBytes: number) {
    const len = Number(res.headers.get('content-length') || 0);
    if (len > maxBytes) throw new BadRequestException('图片超过大小限制');
    const reader = res.body?.getReader();
    if (!reader) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > maxBytes) throw new BadRequestException('图片超过大小限制');
      return buf;
    }
    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) throw new BadRequestException('图片超过大小限制');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  private parseFeed(xml: string, baseUrl: string): FeedItem[] {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      cdataPropName: '#cdata',
      trimValues: false,
    });
    const doc = parser.parse(xml);
    const channel = doc?.rss?.channel || doc?.rdf?.channel;
    const rawItems = this.toArray(channel?.item || doc?.feed?.entry || doc?.item);
    return rawItems
      .map((item) => this.parseFeedItem(item, baseUrl))
      .filter((item) => item.title || item.link || item.summary);
  }

  private parseFeedItem(item: any, baseUrl: string): FeedItem {
    const title = this.limitText(this.stripHtml(this.nodeText(item?.title)), 180);
    const link = this.resolveUrl(this.itemLink(item), baseUrl) || baseUrl;
    const guid = this.limitText(
      this.nodeText(item?.guid || item?.id) || link || title,
      255,
    );
    const html =
      this.nodeText(item?.['content:encoded']) ||
      this.nodeText(item?.content) ||
      this.nodeText(item?.description) ||
      this.nodeText(item?.summary) ||
      '';
    const summary = this.limitText(
      this.stripHtml(this.nodeText(item?.description || item?.summary) || html),
      240,
    );
    const content = this.limitText(this.stripHtml(html || summary), 3000);
    const images = this.extractImages(item, html, link || baseUrl);
    return { title, link, guid, html, summary, content, images };
  }

  private extractImages(item: any, html: string, baseUrl: string) {
    const urls: string[] = [];
    const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = imgRe.exec(html || ''))) urls.push(m[1]);
    for (const node of [
      ...this.toArray(item?.['media:content']),
      ...this.toArray(item?.['media:thumbnail']),
      ...this.toArray(item?.enclosure),
    ]) {
      const url = typeof node === 'string' ? node : node?.['@_url'];
      const type = String(node?.['@_type'] || '');
      if (url && (!type || type.startsWith('image/'))) urls.push(url);
    }
    return urls
      .map((u) => this.resolveUrl(this.decodeEntities(String(u).trim()), baseUrl))
      .filter(Boolean) as string[];
  }

  private itemLink(item: any) {
    const link = item?.link;
    if (typeof link === 'string') return link;
    if (Array.isArray(link)) {
      const alt = link.find((l) => !l?.['@_rel'] || l?.['@_rel'] === 'alternate');
      return alt?.['@_href'] || this.nodeText(alt) || link[0]?.['@_href'] || '';
    }
    if (link && typeof link === 'object') return link['@_href'] || this.nodeText(link);
    return '';
  }

  private renderTemplate(template: string, item: FeedItem) {
    const vars: Record<string, string> = {
      title: item.title,
      summary: item.summary,
      content: item.content || item.summary,
      sourceUrl: item.link,
    };
    return template.replace(/\{(title|summary|content|sourceUrl)\}/g, (_, k) => vars[k] || '');
  }

  private nodeText(value: any): string {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') {
      return this.decodeEntities(String(value));
    }
    if (Array.isArray(value)) return this.nodeText(value[0]);
    if (typeof value === 'object') {
      return this.decodeEntities(
        String(value['#cdata'] || value['#text'] || value._ || ''),
      );
    }
    return '';
  }

  private stripHtml(html: string) {
    return this.decodeEntities(
      String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[ \t\r\f\v]+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    );
  }

  private decodeEntities(text: string) {
    return String(text || '')
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private toArray<T = any>(value: T | T[] | undefined | null): T[] {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }

  private resolveUrl(raw: string, baseUrl: string) {
    if (!raw) return '';
    try {
      return new URL(raw, baseUrl).toString();
    } catch {
      return '';
    }
  }

  private itemHash(sourceId: number, item: FeedItem) {
    return createHash('sha256')
      .update(`${sourceId}:${item.guid || item.link || item.title}`)
      .digest('hex');
  }

  private limitText(text: string, max: number) {
    return Array.from(String(text || '').trim()).slice(0, max).join('');
  }

  private imageNameFromUrl(url: string, mimetype: string) {
    let name = 'rss-image';
    try {
      name = basename(new URL(url).pathname) || name;
    } catch {
      /* keep fallback */
    }
    const ext = extname(name);
    if (ext) return name.slice(0, 100);
    const byType: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    return `${name}${byType[mimetype] || '.jpg'}`.slice(0, 100);
  }

  private assertHttpUrl(url: string) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('protocol');
      }
    } catch {
      throw new BadRequestException('请输入有效的 http/https 地址');
    }
  }

  private async assertPublicHttpUrl(url: string) {
    this.assertHttpUrl(url);
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost')) {
      throw new BadRequestException('不允许访问本机地址');
    }
    const records = isIP(host)
      ? [{ address: host }]
      : await lookup(host, { all: true }).catch(() => []);
    if (!records.length) throw new BadRequestException('无法解析目标地址');
    if (records.some((r) => this.isPrivateAddress(r.address))) {
      throw new BadRequestException('不允许访问内网地址');
    }
  }

  private isPrivateAddress(address: string) {
    if (address.startsWith('::ffff:')) {
      return this.isPrivateAddress(address.slice(7));
    }
    if (isIP(address) === 4) {
      const p = address.split('.').map((n) => Number(n));
      return (
        p[0] === 0 ||
        p[0] === 10 ||
        p[0] === 127 ||
        (p[0] === 169 && p[1] === 254) ||
        (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
        (p[0] === 192 && p[1] === 168) ||
        (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
        (p[0] === 198 && (p[1] === 18 || p[1] === 19)) ||
        p[0] >= 224
      );
    }
    const v6 = address.toLowerCase();
    return (
      v6 === '::' ||
      v6 === '::1' ||
      v6.startsWith('fc') ||
      v6.startsWith('fd') ||
      v6.startsWith('fe80:')
    );
  }

  private parseSqlTime(value: string | null) {
    if (!value) return 0;
    const t = Date.parse(`${value.replace(' ', 'T')}Z`);
    return Number.isFinite(t) ? t : 0;
  }

  private async ensureSchema() {
    const type = String(this.dataSource.options.type || '');
    if (type === 'postgres' || type === 'postgresql') {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS external_sync_sources (
          id SERIAL PRIMARY KEY,
          user_id INT NOT NULL,
          board_id INT NOT NULL,
          name VARCHAR(120) NOT NULL,
          rss_url TEXT NOT NULL,
          template TEXT NOT NULL,
          enabled SMALLINT NOT NULL DEFAULT 1,
          auto_publish SMALLINT NOT NULL DEFAULT 1,
          max_images INT NOT NULL DEFAULT 3,
          fetch_interval_min INT NOT NULL DEFAULT 60,
          last_fetched_at VARCHAR(32) NULL,
          created_at VARCHAR(32) NULL,
          updated_at VARCHAR(32) NULL
        )
      `);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS external_sync_imports (
          id SERIAL PRIMARY KEY,
          source_id INT NOT NULL,
          source_url TEXT NOT NULL,
          source_guid VARCHAR(255) NOT NULL,
          source_hash VARCHAR(64) NOT NULL,
          title VARCHAR(200) NOT NULL,
          status VARCHAR(24) NOT NULL DEFAULT 'published',
          thread_id INT NULL,
          error TEXT NOT NULL DEFAULT '',
          created_at VARCHAR(32) NULL
        )
      `);
      await this.dataSource.query(
        'CREATE INDEX IF NOT EXISTS idx_external_sync_sources_user ON external_sync_sources(user_id)',
      );
      await this.dataSource.query(
        'CREATE INDEX IF NOT EXISTS idx_external_sync_sources_board ON external_sync_sources(board_id)',
      );
      await this.dataSource.query(
        'CREATE INDEX IF NOT EXISTS idx_external_sync_imports_source ON external_sync_imports(source_id)',
      );
      await this.dataSource.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_external_sync_imports_source_hash ON external_sync_imports(source_id, source_hash)',
      );
      return;
    }

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS external_sync_sources (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        board_id INT NOT NULL,
        name VARCHAR(120) NOT NULL,
        rss_url TEXT NOT NULL,
        template TEXT NOT NULL,
        enabled SMALLINT NOT NULL DEFAULT 1,
        auto_publish SMALLINT NOT NULL DEFAULT 1,
        max_images INT NOT NULL DEFAULT 3,
        fetch_interval_min INT NOT NULL DEFAULT 60,
        last_fetched_at VARCHAR(32) NULL,
        created_at VARCHAR(32) NULL,
        updated_at VARCHAR(32) NULL,
        INDEX idx_external_sync_sources_user (user_id),
        INDEX idx_external_sync_sources_board (board_id)
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS external_sync_imports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        source_id INT NOT NULL,
        source_url TEXT NOT NULL,
        source_guid VARCHAR(255) NOT NULL,
        source_hash VARCHAR(64) NOT NULL,
        title VARCHAR(200) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'published',
        thread_id INT NULL,
        error TEXT NOT NULL,
        created_at VARCHAR(32) NULL,
        UNIQUE KEY uq_external_sync_imports_source_hash (source_id, source_hash),
        INDEX idx_external_sync_imports_source (source_id)
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
}

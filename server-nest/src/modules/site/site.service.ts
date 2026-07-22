import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfficialPage, Post, SiteConfig, Topic, User } from '../../database/entities';

// 模块市场 (C)：可开关的功能模块 key（与前端导航 module 一致）。Mirrors server/src/helpers.js MODULE_KEYS.
export const MODULE_KEYS = [
  'discover', 'circles', 'qa', 'flash', 'articles', 'events', 'nav',
  'forum', 'leaderboard', 'achievements', 'checkin', 'lottery', 'mall',
];

// 布局市场：站长可在后台为这些页面选择布局（default 三栏 / wide 宽屏 / narrow 居中）。
// 不设置则用各页内置默认（前端 fallback），保证零回归。
export const LAYOUT_PAGES = [
  'collections', 'nav', 'mall', 'circles', 'achievements', 'member',
  'bookmarks', 'history', 'settings', 'changelog', 'thread',
];
export const LAYOUT_VALUES = ['default', 'wide', 'narrow'];

// 右侧栏组件市场：组件 key 与前端 RightSidebar.SIDEBAR_BLOCKS 保持一致。
export const SIDEBAR_BLOCK_KEYS = [
  'hotTopics',
  'qa',
  'circles',
  'flash',
  'whoToFollow',
  'checkinRank',
  'trendingSearch',
  'footer',
  'forumMyBoards',
  'forumBoards',
  'boardModerators',
  'boardChildren',
  'postRelated',
  'articleTrending',
  'articleCategories',
  'articleRelated',
  'eventTips',
  'eventAttendees',
  'checkinStreakers',
  'checkinRules',
  'lotteryWinners',
  'lotteryMyRecords',
  'circleMembers',
  'circleAbout',
  'leaderboardMine',
  'leaderboardRules',
];

// 支持按页面配置右侧栏组件；default 为全站默认。
export const SIDEBAR_PAGES = [
  'default',
  'home',
  'discover',
  'forum',
  'board',
  'thread',
  'post',
  'topic',
  'circles',
  'circle',
  'qa',
  'flash',
  'articles',
  'article',
  'collections',
  'collection',
  'events',
  'event',
  'leaderboard',
  'checkin',
  'lottery',
  'profile',
  'search',
  'mall',
  'member',
  'bookmarks',
  'history',
  'settings',
  'changelog',
];

function normalizeOfficialSlug(slug: string) {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 站点配置读写（site_config 表）。Mirrors server/src/routes/site.js + helpers getConfig/moduleStates.
 */
@Injectable()
export class SiteService {
  constructor(
    @InjectRepository(SiteConfig) private readonly repo: Repository<SiteConfig>,
    @InjectRepository(OfficialPage) private readonly officialPages: Repository<OfficialPage>,
    @InjectRepository(Topic) private readonly topics: Repository<Topic>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
  ) {}

  async getConfig(key: string, fallback: string | null = null): Promise<string | null> {
    const row = await this.repo.findOne({ where: { key } });
    return row ? row.value : fallback;
  }

  async setConfig(key: string, value: string): Promise<void> {
    await this.repo.save(this.repo.create({ key, value: String(value) }));
  }

  async moduleStates(): Promise<Record<string, boolean>> {
    const rows = await this.repo.find();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const out: Record<string, boolean> = {};
    for (const k of MODULE_KEYS) out[k] = map.get(`module_${k}`) !== '0'; // 默认开启
    return out;
  }

  // ---- GET /api/site —— 公开品牌 + 自定义 CSS + 模块开关 ----
  async getSite() {
    const rows = await this.repo.find();
    const cfg = new Map(rows.map((r) => [r.key, r.value]));
    const modules: Record<string, boolean> = {};
    for (const k of MODULE_KEYS) modules[k] = cfg.get(`module_${k}`) !== '0';
    const layouts: Record<string, string> = {};
    for (const k of LAYOUT_PAGES) { const v = cfg.get(`layout_${k}`); if (v) layouts[k] = v; }
    const sidebars: Record<string, string[]> = {};
    for (const k of SIDEBAR_PAGES) {
      const blocks = this.parseSidebarBlocks(cfg.get(`sidebar_${k}`));
      if (blocks.length) sidebars[k] = blocks;
    }
    // 支付网关：公开接口只暴露「哪些已启用」，绝不返回密钥/凭据
    const payments = {
      alipay: cfg.get('pay_alipay_enabled') === '1',
      wechat: cfg.get('pay_wechat_enabled') === '1',
      epay: cfg.get('pay_epay_enabled') === '1',
    };
    return {
      name: cfg.get('site_name') || 'SaotieSNS',
      slogan: cfg.get('site_slogan') || '轻社交社区',
      logo: cfg.get('site_logo') || '',
      customCss: cfg.get('site_custom_css') || '',
      copyright: cfg.get('site_copyright') || '',
      icp: cfg.get('site_icp') || '',
      publicSecurity: cfg.get('site_public_security') || '',
      footerHtml: cfg.get('site_footer_html') || '',
      analyticsCode: cfg.get('site_analytics_code') || '',
      allowGuest: cfg.get('allow_guest') !== '0',
      authHero: {
        title: cfg.get('auth_hero_title') || '',
        subtitle: cfg.get('auth_hero_subtitle') || '',
        points: cfg.get('auth_hero_points') || '',
        bgUrl: cfg.get('auth_bg_url') || '',
        bgType: cfg.get('auth_bg_type') || 'image',
      },
      modules,
      layouts,
      sidebars,
      payments,
    };
  }

  private serializeOfficialPage(page: OfficialPage) {
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      seoTitle: page.seo_title || '',
      seoKeywords: page.seo_keywords || '',
      seoDescription: page.seo_description || '',
      cover: page.cover || '',
      content: page.content || '',
      status: page.status === 1,
      sort: Number(page.sort || 0),
      createdAt: page.created_at,
      updatedAt: page.updated_at,
    };
  }

  async getOfficialPages() {
    const pages = await this.officialPages.find({
      where: { status: 1 },
      order: { sort: 'ASC', id: 'ASC' },
    });
    return {
      pages: pages.map((page) => this.serializeOfficialPage(page)),
    };
  }

  async getOfficialPage(slug: string) {
    const clean = normalizeOfficialSlug(slug) || 'home';
    const page = await this.officialPages.findOne({ where: { slug: clean, status: 1 } });
    if (!page) throw new NotFoundException('页面不存在');
    return { page: this.serializeOfficialPage(page) };
  }

  async getOfficialWidgets() {
    const [hotTopics, latestUsers, users, posts, topics] = await Promise.all([
      this.topics.find({
        order: { hot: 'DESC', post_count: 'DESC', id: 'DESC' },
        take: 8,
      }),
      this.users.find({
        order: { id: 'DESC' },
        take: 8,
      }),
      this.users.count(),
      this.posts.count(),
      this.topics.count(),
    ]);

    return {
      stats: {
        users,
        posts,
        topics,
      },
      hotTopics: hotTopics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        description: topic.description || '',
        cover: topic.cover || '',
        postCount: Number(topic.post_count || 0),
        hot: Number(topic.hot || 0),
        createdAt: topic.created_at,
      })),
      latestUsers: latestUsers.map((user) => ({
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar || '',
        cover: user.cover || '',
        title: user.title || '',
        avatarFrame: user.avatar_frame || '',
        verified: !!user.verified,
        certType: user.cert_type || '',
        certLabel: user.cert_label || '',
        vip: !!user.vip,
        vipLevel: Number(user.vip_level || 0),
        createdAt: user.created_at,
      })),
    };
  }

  async getOfficialBundle(slug: string) {
    const [site, pages, widgets, page] = await Promise.all([
      this.getSite(),
      this.getOfficialPages(),
      this.getOfficialWidgets(),
      this.getOfficialPage(slug),
    ]);
    return { site, pages, widgets, ...page };
  }

  private parseSidebarBlocks(raw?: string) {
    if (!raw) return [];
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = String(raw).split(',');
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((k) => String(k))
      .filter((k) => SIDEBAR_BLOCK_KEYS.includes(k));
  }
}

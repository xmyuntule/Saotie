import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like as TypeOrmLike, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  AdminLog,
  Board,
  Comment,
  ExternalSyncImport,
  Moderator,
  Notification,
  OfficialPage,
  Post,
  Product,
  Report,
  Thread,
  Topic,
  User,
  ViewHistory,
} from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { SensitiveService } from '../../common/sensitive.service';
import {
  MODULE_KEYS,
  LAYOUT_PAGES,
  LAYOUT_VALUES,
  SIDEBAR_BLOCK_KEYS,
  SIDEBAR_PAGES,
  SiteService,
} from '../site/site.service';
import {
  AddModeratorDto,
  CreateBoardDto,
  CreateProductDto,
  CreateTopicDto,
  UpdateAdminThreadDto,
  UpdateBoardDto,
  UpdateUserDto,
} from './dto/admin.dto';

// ===== 站点设置键 (A5 安全 + C 模块市场 + W 外观)。Mirrors server/src/routes/admin.js =====
// 布尔开关：前端传 '1'/'0'（注意 '0' 在 JS 里是 truthy，必须显式判定 true/1/'1'）
const TOGGLE_KEYS = [
  'allow_guest',
  'login_protect_enabled', 'login_captcha_enabled', 'login_admin_strict_enabled',
  'rate_limit_enabled', 'anti_bulk_reg_enabled', 'require_email_verify', 'email_verify_enabled',
  'storage_s3_force_path_style',
  'perm_enabled', 'perm_comment_require_vip', 'perm_dm_require_vip', 'perm_upload_require_vip',
  'perm_post_require_vip', 'perm_thread_require_vip',
  'sensitive_enabled',
  'external_sync_enabled',
  'cert_auto_post_enabled',
  'pay_alipay_enabled', 'pay_wechat_enabled', 'pay_epay_enabled', // 支付网关开关
  'demo_recharge_enabled', // 演示充值开关：开=可模拟充值/开通会员（免真实支付，默认关，未配置视为关）；关=必须走真实支付渠道
  ...MODULE_KEYS.map((k) => `module_${k}`), // 模块市场 (C)：各可选模块开关
];
// 数值型：key → [min, max]，超界 clamp
const NUM_KEYS: Record<string, [number, number]> = {
  login_ip_fail_limit: [1, 1000], login_user_fail_limit: [1, 1000], login_admin_fail_limit: [1, 1000],
  login_captcha_after_fail: [1, 1000], login_admin_captcha_after_fail: [1, 1000],
  login_window_min: [1, 1440], login_lock_min: [1, 1440],
  rate_post_per_min: [0, 1000], rate_post_per_hour: [0, 100000], rate_thread_per_min: [0, 1000], rate_dm_per_min: [0, 10000],
  reg_ip_max_per_day: [0, 10000], reg_min_interval_sec: [0, 86400],
  perm_comment_min_level: [0, 60], perm_dm_min_level: [0, 60], perm_upload_min_level: [0, 60], perm_post_min_level: [0, 60], perm_thread_min_level: [0, 60],
  external_sync_min_level: [0, 60], external_sync_cost_per_post: [0, 100000], external_sync_max_items_per_fetch: [1, 20],
  // 签到配置：基础分 / 连签加成上限(天) / 补签成本(积分)
  checkin_base_points: [0, 1000], checkin_streak_cap: [0, 60], checkin_makeup_cost: [0, 100000],
};
// 字符串型（站点外观自定义 W + 支付网关凭据）：key → 最大长度，超长截断
const STR_KEYS: Record<string, number> = {
  site_name: 40, site_slogan: 60, site_logo: 500, site_custom_css: 20000, sensitive_words: 8000,
  site_copyright: 200, site_icp: 120, site_public_security: 160, site_footer_html: 5000, site_analytics_code: 12000,
  auth_hero_title: 120, auth_hero_subtitle: 240, auth_hero_points: 1200, auth_bg_url: 500, auth_bg_type: 16,
  register_verify_mode: 16,
  storage_driver: 16, storage_s3_region: 80, storage_s3_bucket: 160, storage_s3_endpoint: 500,
  storage_s3_public_url: 500, storage_s3_prefix: 120, storage_s3_access_key: 300, storage_s3_secret_key: 500,
  external_sync_allowed_group: 16,
  cert_auto_post_topic: 32, cert_auto_post_template: 1200,
  // 支付配置（凭据为敏感串，仅 admin 可读写；公开 /api/site 只暴露「是否启用」不含密钥）
  pay_alipay_appid: 64, pay_alipay_key: 4000, pay_alipay_public_key: 2000, pay_alipay_gateway: 200,
  pay_wechat_appid: 64, pay_wechat_mchid: 64, pay_wechat_key: 200, pay_wechat_private_key: 4000, pay_wechat_serial: 80,
  pay_epay_pid: 64, pay_epay_key: 200, pay_epay_url: 200,
};
// 布局型（按页面）：key=layout_<page>，值只允许 default|wide|narrow（枚举校验）
const LAYOUT_KEYS = LAYOUT_PAGES.map((k) => `layout_${k}`);
// 右侧栏型（按页面）：key=sidebar_<page>，值为边栏组件 key 的 JSON 数组。
const SIDEBAR_KEYS = SIDEBAR_PAGES.map((k) => `sidebar_${k}`);
const CONFIG_KEYS = [...TOGGLE_KEYS, ...Object.keys(NUM_KEYS), ...Object.keys(STR_KEYS), ...LAYOUT_KEYS, ...SIDEBAR_KEYS];
// 敏感凭据：GET /config 不回显原值（只告知是否已配置）；PUT 留空=保留原值，不覆盖。避免支付密钥明文回传浏览器。
const SECRET_KEYS = new Set([
  'pay_alipay_key',
  'pay_wechat_key',
  'pay_wechat_private_key',
  'pay_epay_key',
  'storage_s3_access_key',
  'storage_s3_secret_key',
]);

// 管理操作中文标签（审计日志展示用）。Mirrors server/src/routes/admin.js ACTION_LABEL
const ACTION_LABEL: Record<string, string> = {
  'user.update': '编辑用户', 'content.delete': '删除内容', 'report.resolve': '处理举报',
  'board.create': '新建板块', 'board.update': '编辑板块', 'board.delete': '删除板块', 'board.moderator': '版主变更',
  'topic.create': '新建话题', 'topic.update': '编辑话题', 'topic.delete': '删除话题', 'product.create': '上架商品', 'product.update': '编辑商品', 'product.delete': '下架商品',
  'notice.create': '发布公告', 'notice.update': '编辑公告', 'notice.delete': '删除公告', 'config.update': '站点设置',
  'maintenance.cleanup': '数据维护清理',
  'official_page.create': '新建官网页面', 'official_page.update': '编辑官网页面', 'official_page.delete': '删除官网页面',
  'certification.approve': '通过认证', 'certification.reject': '拒绝认证', 'certification.revoke': '撤销认证',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAINTENANCE_TARGETS = [
  {
    key: 'adminAudit',
    label: '管理操作日志',
    description: '清理较早的后台操作审计记录，保留近期操作用于追踪。',
    defaultDays: 180,
    minDays: 30,
    maxDays: 3650,
  },
  {
    key: 'readNotifications',
    label: '已读通知',
    description: '仅清理用户已经读过的旧通知，未读通知不会被删除。',
    defaultDays: 90,
    minDays: 7,
    maxDays: 3650,
  },
  {
    key: 'viewHistory',
    label: '浏览历史',
    description: '清理用户较早的浏览足迹，不影响内容本身。',
    defaultDays: 90,
    minDays: 7,
    maxDays: 3650,
  },
  {
    key: 'externalSyncImports',
    label: '站外同步失败/隐藏记录',
    description: '只清理失败、隐藏或已清空的同步导入记录，保留已发布记录用于去重。',
    defaultDays: 60,
    minDays: 7,
    maxDays: 3650,
  },
  {
    key: 'resolvedReports',
    label: '已处理举报',
    description: '清理已处理的旧举报记录，待处理举报不会被删除。',
    defaultDays: 180,
    minDays: 30,
    maxDays: 3650,
  },
] as const;

type MaintenanceTargetKey = typeof MAINTENANCE_TARGETS[number]['key'];

/**
 * Ported from server/src/routes/admin.js. Admin-only (AdminGuard). Site
 * overview, user management, board/topic/product CRUD, moderators, reports,
 * and content deletion. Daily counts match a day via a LIKE 'YYYY-MM-DD%'
 * prefix (timestamps are stored as sortable strings) so it is portable.
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Thread) private readonly threads: Repository<Thread>,
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
    @InjectRepository(Topic) private readonly topics: Repository<Topic>,
    @InjectRepository(Board) private readonly boards: Repository<Board>,
    @InjectRepository(Moderator)
    private readonly moderators: Repository<Moderator>,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(AdminLog) private readonly adminLogs: Repository<AdminLog>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(ViewHistory)
    private readonly viewHistory: Repository<ViewHistory>,
    @InjectRepository(ExternalSyncImport)
    private readonly externalSyncImports: Repository<ExternalSyncImport>,
    @InjectRepository(OfficialPage)
    private readonly officialPages: Repository<OfficialPage>,
    private readonly helpers: HelpersService,
    private readonly site: SiteService,
    private readonly sensitive: SensitiveService,
  ) {}

  // ---- GET /api/admin/audit —— 管理操作日志 ----
  async getAudit() {
    const rows = await this.adminLogs.find({
      order: { created_at: 'DESC' },
      take: 120,
    });
    const logs: any[] = [];
    for (const r of rows) {
      logs.push({
        id: r.id,
        action: r.action,
        actionLabel: ACTION_LABEL[r.action] || r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        detail: r.detail,
        createdAt: r.created_at,
        admin: await this.helpers.publicUser(
          await this.helpers.getUser(r.admin_id),
        ),
      });
    }
    return { logs };
  }

  private maintenanceConfig(key: string) {
    return MAINTENANCE_TARGETS.find((t) => t.key === key);
  }

  private retentionDays(key: MaintenanceTargetKey, input: Record<string, any> = {}) {
    const cfg = this.maintenanceConfig(key)!;
    const raw = input[key] ?? cfg.defaultDays;
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return cfg.defaultDays;
    return Math.max(cfg.minDays, Math.min(cfg.maxDays, n));
  }

  private cutoffSql(days: number) {
    return new Date(Date.now() - days * DAY_MS)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
  }

  private async maintenanceTotal(key: MaintenanceTargetKey) {
    if (key === 'adminAudit') return this.adminLogs.count();
    if (key === 'readNotifications') return this.notifications.count({ where: { read: 1 } });
    if (key === 'viewHistory') return this.viewHistory.count();
    if (key === 'externalSyncImports') {
      return this.externalSyncImports
        .createQueryBuilder('i')
        .where("(i.status != 'published' OR i.hidden = 1 OR i.cleared_at IS NOT NULL OR i.error != '')")
        .getCount();
    }
    if (key === 'resolvedReports') {
      return this.reports
        .createQueryBuilder('r')
        .where("r.status != 'open'")
        .getCount();
    }
    return 0;
  }

  private async maintenanceExpiredCount(key: MaintenanceTargetKey, cutoff: string) {
    if (key === 'adminAudit') {
      return this.adminLogs
        .createQueryBuilder('x')
        .where('x.created_at IS NOT NULL AND x.created_at < :cutoff', { cutoff })
        .getCount();
    }
    if (key === 'readNotifications') {
      return this.notifications
        .createQueryBuilder('x')
        .where('x.read = 1')
        .andWhere('x.created_at IS NOT NULL AND x.created_at < :cutoff', { cutoff })
        .getCount();
    }
    if (key === 'viewHistory') {
      return this.viewHistory
        .createQueryBuilder('x')
        .where('x.viewed_at IS NOT NULL AND x.viewed_at < :cutoff', { cutoff })
        .getCount();
    }
    if (key === 'externalSyncImports') {
      return this.externalSyncImports
        .createQueryBuilder('x')
        .where('x.created_at IS NOT NULL AND x.created_at < :cutoff', { cutoff })
        .andWhere("(x.status != 'published' OR x.hidden = 1 OR x.cleared_at IS NOT NULL OR x.error != '')")
        .getCount();
    }
    if (key === 'resolvedReports') {
      return this.reports
        .createQueryBuilder('x')
        .where("x.status != 'open'")
        .andWhere('x.created_at IS NOT NULL AND x.created_at < :cutoff', { cutoff })
        .getCount();
    }
    return 0;
  }

  private async deleteMaintenanceExpired(key: MaintenanceTargetKey, cutoff: string) {
    let result: { affected?: number | null } | null = null;
    if (key === 'adminAudit') {
      result = await this.adminLogs
        .createQueryBuilder()
        .delete()
        .from(AdminLog)
        .where('created_at IS NOT NULL AND created_at < :cutoff', { cutoff })
        .execute();
    } else if (key === 'readNotifications') {
      result = await this.notifications
        .createQueryBuilder()
        .delete()
        .from(Notification)
        .where('read = 1')
        .andWhere('created_at IS NOT NULL AND created_at < :cutoff', { cutoff })
        .execute();
    } else if (key === 'viewHistory') {
      result = await this.viewHistory
        .createQueryBuilder()
        .delete()
        .from(ViewHistory)
        .where('viewed_at IS NOT NULL AND viewed_at < :cutoff', { cutoff })
        .execute();
    } else if (key === 'externalSyncImports') {
      result = await this.externalSyncImports
        .createQueryBuilder()
        .delete()
        .from(ExternalSyncImport)
        .where('created_at IS NOT NULL AND created_at < :cutoff', { cutoff })
        .andWhere("(status != 'published' OR hidden = 1 OR cleared_at IS NOT NULL OR error != '')")
        .execute();
    } else if (key === 'resolvedReports') {
      result = await this.reports
        .createQueryBuilder()
        .delete()
        .from(Report)
        .where("status != 'open'")
        .andWhere('created_at IS NOT NULL AND created_at < :cutoff', { cutoff })
        .execute();
    }
    return Number(result?.affected || 0);
  }

  async getMaintenance() {
    const targets: any[] = [];
    for (const cfg of MAINTENANCE_TARGETS) {
      const days = cfg.defaultDays;
      const cutoff = this.cutoffSql(days);
      targets.push({
        ...cfg,
        retentionDays: days,
        cutoff,
        total: await this.maintenanceTotal(cfg.key),
        expired: await this.maintenanceExpiredCount(cfg.key, cutoff),
      });
    }
    return {
      targets,
      protected: [
        '支付订单、积分明细、余额流水默认保留，用于对账与用户权益追踪。',
        '用户发布的内容、评论、私信默认不作为日志清理目标。',
        '站外同步已发布导入记录默认保留，用于避免重复同步。',
      ],
    };
  }

  async cleanupMaintenance(adminId: number, body: any = {}) {
    const rawTargets = Array.isArray(body.targets) ? body.targets : [];
    const targetKeys = [...new Set(rawTargets.map((k: any) => String(k)))]
      .filter((k: string): k is MaintenanceTargetKey => !!this.maintenanceConfig(k));
    if (!targetKeys.length) throw new BadRequestException('请选择要清理的记录类型');
    const dryRun = body.dryRun === true;
    const retentions = body.retentionDays && typeof body.retentionDays === 'object'
      ? body.retentionDays
      : {};
    const results: any[] = [];
    for (const key of targetKeys) {
      const cfg = this.maintenanceConfig(key)!;
      const days = this.retentionDays(key, retentions);
      const cutoff = this.cutoffSql(days);
      const matched = await this.maintenanceExpiredCount(key, cutoff);
      const deleted = dryRun ? 0 : await this.deleteMaintenanceExpired(key, cutoff);
      results.push({ key, label: cfg.label, retentionDays: days, cutoff, matched, deleted });
    }
    const totalDeleted = results.reduce((sum, r) => sum + Number(r.deleted || 0), 0);
    if (!dryRun) {
      const detail = results
        .map((r) => `${r.label} ${r.deleted}/${r.matched}`)
        .join('；')
        .slice(0, 260);
      await this.helpers.logAdmin(adminId, 'maintenance.cleanup', {
        targetType: 'maintenance',
        detail: `数据维护清理：${detail}`,
      });
    }
    return { ok: true, dryRun, totalDeleted, results };
  }

  private normalizeOfficialSlug(slug: string) {
    return String(slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private officialPageDto(page: OfficialPage) {
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
      url: `https://www.saotie.com/${page.slug === 'home' ? '' : page.slug}`,
    };
  }

  async listOfficialPages() {
    const pages = await this.officialPages.find({ order: { sort: 'ASC', id: 'ASC' } });
    return { pages: pages.map((page) => this.officialPageDto(page)) };
  }

  async saveOfficialPage(adminId: number, id: number | null, body: any = {}) {
    const slug = this.normalizeOfficialSlug(body.slug);
    if (!slug) throw new BadRequestException('请输入页面路径');
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) {
      throw new BadRequestException('页面路径只能包含小写字母、数字和连字符');
    }
    const title = String(body.title || '').trim();
    if (!title) throw new BadRequestException('请输入页面标题');

    const existed = await this.officialPages.findOne({ where: { slug } });
    if (existed && existed.id !== id) throw new BadRequestException('页面路径已存在');

    let page: OfficialPage;
    if (id) {
      const old = await this.officialPages.findOne({ where: { id } });
      if (!old) throw new NotFoundException('页面不存在');
      page = old;
    } else {
      page = this.officialPages.create();
      page.created_at = new Date().toISOString();
    }

    const cover = String(body.cover || '').trim();
    page.slug = slug;
    page.title = title.slice(0, 120);
    page.seo_title = String(body.seoTitle ?? body.seo_title ?? '').trim().slice(0, 160);
    page.seo_keywords = String(body.seoKeywords ?? body.seo_keywords ?? '').trim().slice(0, 255);
    page.seo_description = String(body.seoDescription ?? body.seo_description ?? '').trim().slice(0, 255);
    page.cover = cover || null;
    page.content = String(body.content ?? '').trim();
    page.status = body.status === false || body.status === 0 || body.status === '0' ? 0 : 1;
    page.sort = Math.max(0, Math.min(99999, Math.round(Number(body.sort) || 0)));
    page.updated_at = new Date().toISOString();

    const saved = await this.officialPages.save(page);
    await this.helpers.logAdmin(adminId, id ? 'official_page.update' : 'official_page.create', {
      targetType: 'official_page',
      targetId: saved.id,
      detail: `${saved.title}（/${saved.slug === 'home' ? '' : saved.slug}）`,
    });
    return { page: this.officialPageDto(saved) };
  }

  async deleteOfficialPage(adminId: number, id: number) {
    const page = await this.officialPages.findOne({ where: { id } });
    if (!page) throw new NotFoundException('页面不存在');
    if (page.slug === 'home') throw new BadRequestException('首页不可删除，可以停用或清空内容');
    await this.officialPages.delete({ id });
    await this.helpers.logAdmin(adminId, 'official_page.delete', {
      targetType: 'official_page',
      targetId: page.id,
      detail: `${page.title}（/${page.slug === 'home' ? '' : page.slug}）`,
    });
    return { ok: true };
  }

  // ---- GET /api/admin/config —— 读取全部站点设置键 ----
  async getConfig() {
    const config: Record<string, string> = {};
    const secretsSet: Record<string, boolean> = {};
    for (const k of CONFIG_KEYS) {
      const v = await this.site.getConfig(k);
      if (SECRET_KEYS.has(k)) {
        // 密钥不回显原值，只告知前端「是否已配置」
        secretsSet[k] = !!(v && String(v).length);
        continue;
      }
      if (v != null) config[k] = v;
    }
    return { config, secretsSet };
  }

  // ---- PUT /api/admin/config —— 写入安全/模块/外观设置 ----
  async updateConfig(adminId: number, updates: Record<string, any>) {
    const changed: string[] = [];
    for (const k of TOGGLE_KEYS) {
      if (k in updates) {
        const v = updates[k];
        // '0' 在 JS 里是 truthy，必须显式判定 true/1/'1' 才算开，否则任何开关都关不掉
        await this.site.setConfig(k, v === true || v === 1 || v === '1' ? '1' : '0');
        changed.push(k);
      }
    }
    for (const [k, [lo, hi]] of Object.entries(NUM_KEYS)) {
      if (k in updates) {
        let n = Math.round(Number(updates[k]));
        if (!Number.isFinite(n)) throw new BadRequestException(`「${k}」必须是数字`);
        n = Math.max(lo, Math.min(hi, n));
        await this.site.setConfig(k, String(n));
        changed.push(k);
      }
    }
    for (const [k, max] of Object.entries(STR_KEYS)) {
      if (k in updates) {
        const val = String(updates[k] ?? '');
        // 密钥字段留空 = 保持原值（不覆盖），避免「未改动即清空」误删凭据
        if (SECRET_KEYS.has(k) && val === '') continue;
        await this.site.setConfig(k, val.slice(0, max));
        changed.push(k);
      }
    }
    for (const k of LAYOUT_KEYS) {
      if (k in updates) {
        const v = String(updates[k] || 'default');
        if (!LAYOUT_VALUES.includes(v)) throw new BadRequestException(`「${k}」布局值无效`);
        await this.site.setConfig(k, v);
        changed.push(k);
      }
    }
    for (const k of SIDEBAR_KEYS) {
      if (k in updates) {
        const blocks = this.normalizeSidebarBlocks(updates[k], k);
        await this.site.setConfig(k, JSON.stringify(blocks));
        changed.push(k);
      }
    }
    // 敏感词配置改动后立即刷新过滤器缓存（否则要等 20s 兜底轮询）
    if (changed.includes('sensitive_enabled') || changed.includes('sensitive_words')) {
      await this.sensitive.refresh().catch(() => undefined);
    }
    await this.helpers.logAdmin(adminId, 'config.update', {
      targetType: 'config',
      detail: `站点设置更新：${changed.join('、') || '无改动'}`,
    });
    return { ok: true, changed };
  }

  private normalizeSidebarBlocks(raw: any, key: string) {
    let list = raw;
    if (typeof raw === 'string') {
      try {
        list = JSON.parse(raw);
      } catch {
        list = raw ? raw.split(',') : [];
      }
    }
    if (!Array.isArray(list)) throw new BadRequestException(`「${key}」右侧栏配置无效`);
    const out: string[] = [];
    for (const item of list) {
      const block = String(item);
      if (!SIDEBAR_BLOCK_KEYS.includes(block)) {
        throw new BadRequestException(`「${key}」包含未知右侧栏组件：${block}`);
      }
      if (!out.includes(block)) out.push(block);
    }
    return out;
  }

  private dayCount(repo: Repository<any>, day: string) {
    return repo.count({ where: { created_at: TypeOrmLike(`${day}%`) } });
  }

  // ---- GET /api/admin/overview ----
  async overview() {
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
        .toISOString()
        .slice(0, 10);
      days.push({
        date: d,
        posts: await this.dayCount(this.posts, d),
        comments: await this.dayCount(this.comments, d),
        users: await this.dayCount(this.users, d),
      });
    }
    const recentUserRows = await this.users.find({
      order: { id: 'DESC' },
      take: 5,
    });
    const recentUsers: any[] = [];
    for (const u of recentUserRows)
      recentUsers.push(await this.helpers.publicUser(u));
    // 今日新增概况（复用 activity 末日的 users/posts/comments；举报另查）。运营每日最关心。
    const td = days[days.length - 1] || { date: new Date().toISOString().slice(0, 10), users: 0, posts: 0, comments: 0 };
    const today = {
      users: td.users,
      posts: td.posts,
      comments: td.comments,
      reports: await this.dayCount(this.reports, td.date),
    };
    // 邀请/推广概况（成长指标）：累计被邀请用户 + 邀请榜 top5
    const invitedTotal = await this.users
      .createQueryBuilder('u')
      .where('u.invited_by IS NOT NULL')
      .getCount();
    const inviterRaw = await this.users
      .createQueryBuilder('u')
      .select('u.invited_by', 'inviterId')
      .addSelect('COUNT(*)', 'n')
      .where('u.invited_by IS NOT NULL')
      .groupBy('u.invited_by')
      .orderBy('n', 'DESC')
      .limit(5)
      .getRawMany();
    const topInviters: any[] = [];
    for (const row of inviterRaw) {
      const u = await this.helpers.getUser(Number(row.inviterId));
      if (u) topInviters.push({ user: await this.helpers.publicUser(u), count: Number(row.n) });
    }
    const invites = { total: invitedTotal, top: topInviters };
    // 充值/营收概况：累计已支付 + 今日已支付（查 payment_orders；用 manager 直查避免额外注入 repo）
    let recharge = { paidCount: 0, paidAmount: '0.00', todayCount: 0, todayAmount: '0.00' };
    try {
      const totalRow = await this.users.manager.query(
        "SELECT COUNT(*) c, COALESCE(SUM(amount),0) amt FROM payment_orders WHERE status='paid'",
      );
      const todayRow = await this.users.manager.query(
        "SELECT COUNT(*) c, COALESCE(SUM(amount),0) amt FROM payment_orders WHERE status='paid' AND paid_at LIKE ?",
        [td.date + '%'],
      );
      recharge = {
        paidCount: Number(totalRow?.[0]?.c || 0),
        paidAmount: Number(totalRow?.[0]?.amt || 0).toFixed(2),
        todayCount: Number(todayRow?.[0]?.c || 0),
        todayAmount: Number(todayRow?.[0]?.amt || 0).toFixed(2),
      };
    } catch { /* 表不存在/查询失败则保持 0，不影响概览 */ }
    return {
      recharge,
      today,
      invites,
      stats: {
        users: await this.users.count(),
        posts: await this.posts.count(),
        threads: await this.threads.count(),
        comments: await this.comments.count(),
        topics: await this.topics.count(),
        boards: await this.boards.count(),
        reports: await this.reports.count({ where: { status: 'open' } }),
        vip: await this.users
          .createQueryBuilder('u')
          .where('u.vip = 1')
          .andWhere("(u.vip_expires IS NULL OR u.vip_expires = '' OR u.vip_expires >= :today)", { today: this.helpers.today() })
          .getCount(),
      },
      activity: days,
      recentUsers,
    };
  }

  // ---- GET /api/admin/users ----
  async listUsers(q: string, filter?: string, offset?: number) {
    const term = (q || '').trim();
    const qb = this.users.createQueryBuilder('u');
    if (term) qb.andWhere('(u.nickname LIKE :like OR u.username LIKE :like)', { like: `%${term}%` });
    if (filter === 'admin') qb.andWhere("u.role = 'admin'");
    else if (filter === 'vip')
      qb.andWhere('u.vip = 1')
        .andWhere("(u.vip_expires IS NULL OR u.vip_expires = '' OR u.vip_expires >= :today)", { today: this.helpers.today() });
    else if (filter === 'banned') qb.andWhere('u.banned = 1');
    const off = Math.max(0, Number(offset) || 0);
    const lim = 100;
    // 多取一条判断是否还有下一页
    const rows = await qb.orderBy('u.id', 'DESC').offset(off).limit(lim + 1).getMany();
    const hasMore = rows.length > lim;
    const page = hasMore ? rows.slice(0, lim) : rows;
    const users: any[] = [];
    for (const u of page)
      users.push({
        ...(await this.helpers.publicUser(u)),
        email: u.email,
        lastLoginAt: u.last_login_at,
      });
    return { users, hasMore };
  }

  // ---- PUT /api/admin/users/:id ----
  async updateUser(adminId: number, id: number, dto: UpdateUserDto) {
    const u = await this.helpers.getUser(id);
    if (!u) throw new NotFoundException('用户不存在');
    const patch: Partial<User> = {};
    const changes: string[] = [];
    if (dto.vip !== undefined) { patch.vip = dto.vip ? 1 : 0; changes.push(dto.vip ? '开VIP' : '关VIP'); }
    if (dto.vipLevel != null) {
      const lvl = Math.max(0, Math.min(3, Math.round(Number(dto.vipLevel))));
      patch.vip_level = lvl; patch.vip = lvl > 0 ? 1 : 0;
      changes.push(lvl > 0 ? `VIP 等级=${lvl}` : '关VIP');
    }
    if (dto.role != null) { patch.role = dto.role; changes.push(`角色=${dto.role}`); }
    if (dto.banned !== undefined) { patch.banned = dto.banned ? 1 : 0; changes.push(dto.banned ? '封禁' : '解封'); }
    if (dto.title != null) { patch.title = dto.title; changes.push('改头衔'); }
    let pointAfter: number | null = null;
    if (dto.points != null) { const p = Math.max(0, Math.round(Number(dto.points))); pointAfter = p; changes.push(`积分=${p}`); }
    if (Object.keys(patch).length)
      await this.users.update({ id: u.id }, patch);
    if (pointAfter != null && pointAfter !== u.points)
      await this.helpers.setPoints(
        u.id,
        pointAfter,
        '管理员调整积分',
        'admin_user',
        u.id,
      );
    await this.helpers.logAdmin(adminId, 'user.update', {
      targetType: 'user',
      targetId: u.id,
      detail: `${u.nickname}（@${u.username}）${changes.join('、') || '资料更新'}`,
    });
    return { user: await this.helpers.publicUser(await this.helpers.getUser(u.id)) };
  }

  // ---- POST /api/admin/users/:id/reset-password （管理员重置用户密码, 帮助找回）----
  async resetUserPassword(adminId: number, id: number, password: string) {
    const u = await this.helpers.getUser(id);
    if (!u) throw new NotFoundException('用户不存在');
    const pw = String(password || '');
    if (pw.length < 6) throw new BadRequestException('新密码至少 6 位');
    await this.users.update({ id: u.id }, { password_hash: bcrypt.hashSync(pw, 10) });
    await this.helpers.logAdmin(adminId, 'user.resetpw', {
      targetType: 'user',
      targetId: u.id,
      detail: `重置 ${u.nickname}（@${u.username}）的登录密码`,
    });
    await this.helpers
      .notify({ userId: u.id, actorId: null, type: 'system', preview: '管理员已重置你的登录密码，请用新密码登录' })
      .catch(() => undefined);
    return { ok: true };
  }

  // ---- POST /api/admin/boards ----
  async createBoard(adminId: number, dto: CreateBoardDto) {
    const {
      name,
      slug,
      description = '',
      cover = null,
      icon = '📁',
      parentId = null,
      announcement = '',
    } = dto;
    if (!name || !slug)
      throw new BadRequestException('板块名称和 slug 必填');
    if (await this.boards.findOne({ where: { slug } }))
      throw new ConflictException('slug 已存在');
    const saved = await this.boards.save(
      this.boards.create({
        parent_id: parentId || null,
        name,
        slug,
        description,
        cover: cover || null,
        icon,
        announcement,
        is_paid: dto.isPaid ? 1 : 0,
        price: dto.price ?? 0,
        sort: Math.round(Number(dto.sort) || 0),
        created_at: this.helpers.nowSql(),
      }),
    );
    await this.helpers.logAdmin(adminId, 'board.create', {
      targetType: 'board',
      targetId: saved.id,
      detail: name,
    });
    return { board: await this.boards.findOne({ where: { id: saved.id } }) };
  }

  // ---- PUT /api/admin/boards/:id ----
  async updateBoard(adminId: number, id: number, dto: UpdateBoardDto) {
    const b = await this.boards.findOne({ where: { id } });
    if (!b) throw new NotFoundException('板块不存在');
    const patch: Partial<Board> = {};
    if (dto.name != null) patch.name = dto.name;
    if (dto.description != null) patch.description = dto.description;
    if (dto.cover != null) patch.cover = dto.cover.trim() || null;
    if (dto.icon != null) patch.icon = dto.icon;
    if (dto.parentId !== undefined) {
      const pid = Number(dto.parentId) || 0;
      if (pid === id) throw new BadRequestException('父板块不能设置为自己');
      if (pid > 0 && !(await this.boards.findOne({ where: { id: pid } })))
        throw new BadRequestException('父板块不存在');
      patch.parent_id = pid > 0 ? pid : null;
    }
    if (dto.announcement != null) patch.announcement = dto.announcement;
    if (dto.isPaid !== undefined) patch.is_paid = dto.isPaid ? 1 : 0;
    if (dto.price != null) patch.price = dto.price;
    if (dto.sort != null) patch.sort = dto.sort;
    if (Object.keys(patch).length)
      await this.boards.update({ id: b.id }, patch);
    await this.helpers.logAdmin(adminId, 'board.update', {
      targetType: 'board',
      targetId: b.id,
      detail: dto.name || b.name,
    });
    return { ok: true };
  }

  // ---- DELETE /api/admin/boards/:id ----
  async deleteBoard(adminId: number, id: number) {
    const b = await this.boards.findOne({ where: { id } });
    await this.boards.delete({ id });
    await this.helpers.logAdmin(adminId, 'board.delete', {
      targetType: 'board',
      targetId: id,
      detail: b?.name || `#${id}`,
    });
    return { ok: true };
  }

  // ---- POST /api/admin/boards/:id/moderators ----
  async toggleModerator(boardId: number, actor: User, dto: AddModeratorDto) {
    const u = await this.users
      .createQueryBuilder('u')
      .where('u.username = :name OR u.nickname = :name', {
        name: dto.username,
      })
      .getOne();
    if (!u) throw new NotFoundException('用户不存在');
    const exists = await this.moderators.findOne({
      where: { board_id: boardId, user_id: u.id },
    });
    if (exists) {
      await this.moderators.delete({ board_id: boardId, user_id: u.id });
      await this.helpers.logAdmin(actor.id, 'board.moderator', {
        targetType: 'board',
        targetId: boardId,
        detail: `取消 @${u.username} 的版主`,
      });
      return { added: false };
    }
    await this.moderators.insert({ board_id: boardId, user_id: u.id });
    await this.helpers.notify({
      userId: u.id,
      actorId: actor.id,
      type: 'system',
      preview: '你已被任命为板块版主 🛡️',
    });
    await this.helpers.logAdmin(actor.id, 'board.moderator', {
      targetType: 'board',
      targetId: boardId,
      detail: `任命 @${u.username} 为版主`,
    });
    return { added: true, user: await this.helpers.publicUser(u) };
  }

  async listForumThreads(q = '', boardId = 0, offset = 0) {
    const off = Math.max(0, Number(offset) || 0);
    const lim = 30;
    let qb = this.threads
      .createQueryBuilder('t')
      .orderBy('t.created_at', 'DESC')
      .addOrderBy('t.id', 'DESC');
    const keyword = String(q || '').trim();
    if (keyword) {
      qb = qb.andWhere('(t.title LIKE :q OR t.content LIKE :q)', {
        q: `%${keyword}%`,
      });
    }
    if (boardId > 0) {
      qb = qb.andWhere('t.board_id = :boardId', { boardId });
    }
    const rows = await qb.offset(off).limit(lim + 1).getMany();
    const hasMore = rows.length > lim;
    const threads: any[] = [];
    for (const t of rows.slice(0, lim)) {
      const [board, author] = await Promise.all([
        this.boards.findOne({ where: { id: t.board_id } }),
        this.helpers.getUser(t.user_id),
      ]);
      threads.push({
        id: t.id,
        title: t.title,
        content: t.content || '',
        boardId: t.board_id,
        board: board
          ? { id: board.id, name: board.name, slug: board.slug, icon: board.icon }
          : null,
        author: await this.helpers.publicUser(author),
        pinned: !!t.pinned,
        elite: !!t.elite,
        locked: !!t.locked,
        views: t.views,
        likeCount: t.like_count,
        replyCount: t.reply_count,
        createdAt: t.created_at,
        lastReplyAt: t.last_reply_at,
      });
    }
    return { threads, hasMore };
  }

  async updateForumThread(
    adminId: number,
    id: number,
    dto: UpdateAdminThreadDto,
  ) {
    const t = await this.threads.findOne({ where: { id } });
    if (!t) throw new NotFoundException('帖子不存在');
    const patch: Partial<Thread> = { edited: 1 };
    let movedToBoard: Board | null = null;
    if (dto.title != null) {
      const title = String(dto.title).trim();
      if (!title) throw new BadRequestException('标题不能为空');
      patch.title = title.slice(0, 200);
    }
    if (dto.content != null) {
      const content = String(dto.content).trim();
      if (!content) throw new BadRequestException('正文不能为空');
      patch.content = content;
    }
    if (dto.boardId != null && Number(dto.boardId) !== t.board_id) {
      movedToBoard = await this.boards.findOne({ where: { id: Number(dto.boardId) } });
      if (!movedToBoard) throw new BadRequestException('目标板块不存在');
      patch.board_id = movedToBoard.id;
    }
    if (dto.pinned !== undefined) patch.pinned = dto.pinned ? 1 : 0;
    if (dto.elite !== undefined) patch.elite = dto.elite ? 1 : 0;
    if (dto.locked !== undefined) patch.locked = dto.locked ? 1 : 0;
    await this.threads.update({ id: t.id }, patch);
    if (movedToBoard) {
      await this.decrementBoardThreadCount(t.board_id);
      await this.boards.increment({ id: movedToBoard.id }, 'thread_count', 1);
    }
    await this.helpers.logAdmin(adminId, 'forum.thread.update', {
      targetType: 'thread',
      targetId: t.id,
      detail: dto.title || t.title,
    });
    const fresh = await this.threads.findOne({ where: { id: t.id } });
    return { thread: fresh };
  }

  async deleteForumThread(adminId: number, id: number) {
    const t = await this.threads.findOne({ where: { id } });
    if (!t) throw new NotFoundException('帖子不存在');
    await this.comments.delete({ thread_id: t.id });
    await this.threads.delete({ id: t.id });
    await this.decrementBoardThreadCount(t.board_id);
    await this.helpers.logAdmin(adminId, 'forum.thread.delete', {
      targetType: 'thread',
      targetId: t.id,
      detail: t.title,
    });
    return { ok: true };
  }

  private async decrementBoardThreadCount(boardId: number) {
    await this.boards
      .query(
        'UPDATE boards SET thread_count = GREATEST(0, thread_count - 1) WHERE id = ?',
        [boardId],
      )
      .catch(() =>
        this.boards.query(
          'UPDATE boards SET thread_count = GREATEST(0, thread_count - 1) WHERE id = $1',
          [boardId],
        ),
      );
  }

  // ---- POST /api/admin/topics ----
  async createTopic(adminId: number, dto: CreateTopicDto) {
    const { name, description = '' } = dto;
    if (!name) throw new BadRequestException('话题名必填');
    if (await this.topics.findOne({ where: { name } }))
      throw new ConflictException('话题已存在');
    const saved = await this.topics.save(
      this.topics.create({
        name,
        description,
        hot: 50,
        created_at: this.helpers.nowSql(),
      }),
    );
    await this.helpers.logAdmin(adminId, 'topic.create', {
      targetType: 'topic',
      targetId: saved.id,
      detail: `#${name}#`,
    });
    return { topic: await this.topics.findOne({ where: { id: saved.id } }) };
  }

  // ---- PUT /api/admin/topics/:id —— 编辑话题(描述/封面/热度；热度影响发现页排序) ----
  async updateTopic(adminId: number, id: number, dto: CreateTopicDto) {
    const t = await this.topics.findOne({ where: { id } });
    if (!t) throw new NotFoundException('话题不存在');
    const patch: Partial<Topic> = {};
    const changes: string[] = [];
    if (dto.name != null && dto.name.trim()) { patch.name = dto.name.trim().slice(0, 64); changes.push('改名'); }
    if (dto.description != null) patch.description = dto.description;
    if (dto.cover != null) { patch.cover = dto.cover.trim() || null; changes.push('封面'); }
    if (dto.hot != null) { patch.hot = Math.max(0, Math.round(Number(dto.hot))); changes.push(`热度=${patch.hot}`); }
    if (Object.keys(patch).length) await this.topics.update({ id }, patch);
    await this.helpers.logAdmin(adminId, 'topic.update', {
      targetType: 'topic',
      targetId: id,
      detail: `#${dto.name || t.name}#${changes.length ? ' · ' + changes.join('、') : ''}`,
    });
    return { ok: true };
  }

  // ---- DELETE /api/admin/topics/:id ----
  async deleteTopic(adminId: number, id: number) {
    const t = await this.topics.findOne({ where: { id } });
    await this.topics.delete({ id });
    await this.helpers.logAdmin(adminId, 'topic.delete', {
      targetType: 'topic',
      targetId: id,
      detail: t ? `#${t.name}#` : `#${id}`,
    });
    return { ok: true };
  }

  private async reportTarget(type: string, id: number) {
    if (type === 'post') {
      const p = await this.posts.findOne({ where: { id } });
      return p
        ? {
            exists: true,
            text: (p.content || '(无文字)').slice(0, 80),
            author: await this.helpers.publicUser(
              await this.helpers.getUser(p.user_id),
            ),
          }
        : { exists: false };
    }
    if (type === 'thread') {
      const t = await this.threads.findOne({ where: { id } });
      return t
        ? {
            exists: true,
            text: t.title,
            author: await this.helpers.publicUser(
              await this.helpers.getUser(t.user_id),
            ),
          }
        : { exists: false };
    }
    if (type === 'comment') {
      const c = await this.comments.findOne({ where: { id } });
      return c
        ? {
            exists: true,
            text: (c.content || '').slice(0, 80),
            author: await this.helpers.publicUser(
              await this.helpers.getUser(c.user_id),
            ),
          }
        : { exists: false };
    }
    if (type === 'user') {
      const u = await this.helpers.getUser(id);
      return u
        ? {
            exists: true,
            text: `@${u.username}`,
            author: await this.helpers.publicUser(u),
          }
        : { exists: false };
    }
    return { exists: false };
  }

  // ---- GET /api/admin/reports ----
  async listReports(status?: string) {
    const st = status === 'resolved' ? 'resolved' : 'open';
    const rows = await this.reports.find({
      where: { status: st },
      order: { created_at: 'DESC' },
      take: 100,
    });
    const reports: any[] = [];
    for (const r of rows) {
      reports.push({
        id: r.id,
        targetType: r.target_type,
        targetId: r.target_id,
        reason: r.reason,
        createdAt: r.created_at,
        reporter: await this.helpers.publicUser(
          await this.helpers.getUser(r.reporter_id),
        ),
        target: await this.reportTarget(r.target_type, r.target_id),
      });
    }
    return { reports };
  }

  // ---- POST /api/admin/reports/:id/resolve ----
  async resolveReport(adminId: number, id: number) {
    const r = await this.reports.findOne({ where: { id } });
    await this.reports.update({ id }, { status: 'resolved' });
    await this.helpers.logAdmin(adminId, 'report.resolve', {
      targetType: 'report',
      targetId: id,
      detail: `处理${r ? ` ${r.target_type}` : ''}举报 #${id}`,
    });
    return { ok: true };
  }

  // ---- POST /api/admin/products ----
  async createProduct(adminId: number, dto: CreateProductDto) {
    const {
      name,
      description = '',
      icon = '🎁',
      category = 'item',
      payload = '',
      price,
      stock = -1,
    } = dto;
    if (!name || !price) throw new BadRequestException('名称和价格必填');
    const saved = await this.products.save(
      this.products.create({
        name,
        description,
        icon,
        category,
        payload,
        price,
        stock,
        created_at: this.helpers.nowSql(),
      }),
    );
    await this.helpers.logAdmin(adminId, 'product.create', {
      targetType: 'product',
      targetId: saved.id,
      detail: `${name} · ${price}积分`,
    });
    return { product: await this.products.findOne({ where: { id: saved.id } }) };
  }

  // ---- PUT /api/admin/products/:id —— 编辑商品(名称/图标/分类/价格/库存/说明/发放内容) ----
  async updateProduct(adminId: number, id: number, dto: CreateProductDto) {
    const p = await this.products.findOne({ where: { id } });
    if (!p) throw new NotFoundException('商品不存在');
    const patch: Partial<Product> = {};
    const changes: string[] = [];
    if (dto.name != null) { patch.name = dto.name; changes.push('改名'); }
    if (dto.description != null) patch.description = dto.description;
    if (dto.icon != null) patch.icon = dto.icon;
    if (dto.category != null) patch.category = dto.category;
    if (dto.payload != null) patch.payload = dto.payload;
    if (dto.price != null) { patch.price = Math.max(0, Math.round(Number(dto.price))); changes.push(`价格=${patch.price}`); }
    if (dto.stock != null) { patch.stock = Math.max(-1, Math.round(Number(dto.stock))); changes.push(`库存=${patch.stock}`); }
    if (Object.keys(patch).length) await this.products.update({ id }, patch);
    await this.helpers.logAdmin(adminId, 'product.update', {
      targetType: 'product',
      targetId: id,
      detail: `${dto.name || p.name}${changes.length ? ' · ' + changes.join('、') : ''}`,
    });
    return { product: await this.products.findOne({ where: { id } }) };
  }

  // ---- DELETE /api/admin/products/:id ----
  async deleteProduct(adminId: number, id: number) {
    const p = await this.products.findOne({ where: { id } });
    await this.products.delete({ id });
    await this.helpers.logAdmin(adminId, 'product.delete', {
      targetType: 'product',
      targetId: id,
      detail: p?.name || `#${id}`,
    });
    return { ok: true };
  }

  // ---- DELETE /api/admin/content/:type/:id ----
  async deleteContent(adminId: number, type: string, id: number) {
    const repo: Record<string, Repository<any>> = {
      post: this.posts,
      thread: this.threads,
      comment: this.comments,
    };
    const r = repo[type];
    if (!r) throw new BadRequestException('未知类型');
    await r.delete({ id });
    const TYPE_LABEL: Record<string, string> = {
      post: '动态', thread: '帖子', comment: '评论',
    };
    await this.helpers.logAdmin(adminId, 'content.delete', {
      targetType: type,
      targetId: id,
      detail: `删除${TYPE_LABEL[type] || type} #${id}`,
    });
    return { ok: true };
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like as TypeOrmLike, Repository } from 'typeorm';
import {
  AdminLog,
  Board,
  Comment,
  Moderator,
  Post,
  Product,
  Report,
  Thread,
  Topic,
  User,
} from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { SensitiveService } from '../../common/sensitive.service';
import { MODULE_KEYS, LAYOUT_PAGES, LAYOUT_VALUES, SiteService } from '../site/site.service';
import {
  AddModeratorDto,
  CreateBoardDto,
  CreateProductDto,
  CreateTopicDto,
  UpdateBoardDto,
  UpdateUserDto,
} from './dto/admin.dto';

// ===== 站点设置键 (A5 安全 + C 模块市场 + W 外观)。Mirrors server/src/routes/admin.js =====
// 布尔开关：前端传 '1'/'0'（注意 '0' 在 JS 里是 truthy，必须显式判定 true/1/'1'）
const TOGGLE_KEYS = [
  'rate_limit_enabled', 'anti_bulk_reg_enabled', 'require_email_verify', 'email_verify_enabled',
  'perm_enabled', 'perm_comment_require_vip', 'perm_dm_require_vip', 'perm_upload_require_vip',
  'perm_post_require_vip', 'perm_thread_require_vip',
  'sensitive_enabled',
  'pay_alipay_enabled', 'pay_wechat_enabled', 'pay_epay_enabled', // 支付网关开关
  ...MODULE_KEYS.map((k) => `module_${k}`), // 模块市场 (C)：各可选模块开关
];
// 数值型：key → [min, max]，超界 clamp
const NUM_KEYS: Record<string, [number, number]> = {
  rate_post_per_min: [0, 1000], rate_post_per_hour: [0, 100000], rate_thread_per_min: [0, 1000], rate_dm_per_min: [0, 10000],
  reg_ip_max_per_day: [0, 10000], reg_min_interval_sec: [0, 86400],
  perm_comment_min_level: [0, 60], perm_dm_min_level: [0, 60], perm_upload_min_level: [0, 60], perm_post_min_level: [0, 60], perm_thread_min_level: [0, 60],
  // 签到配置：基础分 / 连签加成上限(天) / 补签成本(积分)
  checkin_base_points: [0, 1000], checkin_streak_cap: [0, 60], checkin_makeup_cost: [0, 100000],
};
// 字符串型（站点外观自定义 W + 支付网关凭据）：key → 最大长度，超长截断
const STR_KEYS: Record<string, number> = {
  site_name: 40, site_slogan: 60, site_logo: 500, site_custom_css: 20000, sensitive_words: 8000,
  // 支付配置（凭据为敏感串，仅 admin 可读写；公开 /api/site 只暴露「是否启用」不含密钥）
  pay_alipay_appid: 64, pay_alipay_key: 4000,
  pay_wechat_mchid: 64, pay_wechat_key: 200,
  pay_epay_pid: 64, pay_epay_key: 200, pay_epay_url: 200,
};
// 布局型（按页面）：key=layout_<page>，值只允许 default|wide|narrow（枚举校验）
const LAYOUT_KEYS = LAYOUT_PAGES.map((k) => `layout_${k}`);
const CONFIG_KEYS = [...TOGGLE_KEYS, ...Object.keys(NUM_KEYS), ...Object.keys(STR_KEYS), ...LAYOUT_KEYS];

// 管理操作中文标签（审计日志展示用）。Mirrors server/src/routes/admin.js ACTION_LABEL
const ACTION_LABEL: Record<string, string> = {
  'user.update': '编辑用户', 'content.delete': '删除内容', 'report.resolve': '处理举报',
  'board.create': '新建板块', 'board.update': '编辑板块', 'board.delete': '删除板块', 'board.moderator': '版主变更',
  'topic.create': '新建话题', 'topic.update': '编辑话题', 'topic.delete': '删除话题', 'product.create': '上架商品', 'product.update': '编辑商品', 'product.delete': '下架商品',
  'notice.create': '发布公告', 'notice.update': '编辑公告', 'notice.delete': '删除公告', 'config.update': '站点设置',
};

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

  // ---- GET /api/admin/config —— 读取全部站点设置键 ----
  async getConfig() {
    const config: Record<string, string> = {};
    for (const k of CONFIG_KEYS) {
      const v = await this.site.getConfig(k);
      if (v != null) config[k] = v;
    }
    return { config };
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
        await this.site.setConfig(k, String(updates[k] ?? '').slice(0, max));
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
    return {
      stats: {
        users: await this.users.count(),
        posts: await this.posts.count(),
        threads: await this.threads.count(),
        comments: await this.comments.count(),
        topics: await this.topics.count(),
        boards: await this.boards.count(),
        reports: await this.reports.count({ where: { status: 'open' } }),
        vip: await this.users.count({ where: { vip: 1 } }),
      },
      activity: days,
      recentUsers,
    };
  }

  // ---- GET /api/admin/users ----
  async listUsers(q: string, filter?: string) {
    const term = (q || '').trim();
    const qb = this.users.createQueryBuilder('u');
    if (term) qb.andWhere('(u.nickname LIKE :like OR u.username LIKE :like)', { like: `%${term}%` });
    if (filter === 'admin') qb.andWhere("u.role = 'admin'");
    else if (filter === 'vip') qb.andWhere('u.vip = 1');
    else if (filter === 'banned') qb.andWhere('u.banned = 1');
    const rows = await qb.orderBy('u.id', 'DESC').limit(100).getMany();
    const users: any[] = [];
    for (const u of rows)
      users.push({ ...(await this.helpers.publicUser(u)), email: u.email });
    return { users };
  }

  // ---- PUT /api/admin/users/:id ----
  async updateUser(adminId: number, id: number, dto: UpdateUserDto) {
    const u = await this.helpers.getUser(id);
    if (!u) throw new NotFoundException('用户不存在');
    const patch: Partial<User> = {};
    const changes: string[] = [];
    if (dto.verified !== undefined) { patch.verified = dto.verified ? 1 : 0; changes.push(dto.verified ? '加V' : '取消V'); }
    if (dto.vip !== undefined) { patch.vip = dto.vip ? 1 : 0; changes.push(dto.vip ? '开VIP' : '关VIP'); }
    if (dto.vipLevel != null) {
      const lvl = Math.max(0, Math.min(3, Math.round(Number(dto.vipLevel))));
      patch.vip_level = lvl; patch.vip = lvl > 0 ? 1 : 0;
      changes.push(lvl > 0 ? `VIP 等级=${lvl}` : '关VIP');
    }
    if (dto.role != null) { patch.role = dto.role; changes.push(`角色=${dto.role}`); }
    if (dto.banned !== undefined) { patch.banned = dto.banned ? 1 : 0; changes.push(dto.banned ? '封禁' : '解封'); }
    if (dto.verifiedNote != null) patch.verified_note = dto.verifiedNote;
    if (dto.title != null) { patch.title = dto.title; changes.push('改头衔'); }
    if (dto.points != null) { const p = Math.max(0, Math.round(Number(dto.points))); patch.points = p; changes.push(`积分=${p}`); }
    if (Object.keys(patch).length)
      await this.users.update({ id: u.id }, patch);
    if (dto.verified)
      await this.helpers.notify({
        userId: u.id,
        actorId: null,
        type: 'system',
        preview: '恭喜！你已获得官方 V 认证 ✅',
      });
    await this.helpers.logAdmin(adminId, 'user.update', {
      targetType: 'user',
      targetId: u.id,
      detail: `${u.nickname}（@${u.username}）${changes.join('、') || '资料更新'}`,
    });
    return { user: await this.helpers.publicUser(await this.helpers.getUser(u.id)) };
  }

  // ---- POST /api/admin/boards ----
  async createBoard(adminId: number, dto: CreateBoardDto) {
    const {
      name,
      slug,
      description = '',
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
        icon,
        announcement,
        is_paid: dto.isPaid ? 1 : 0,
        price: dto.price ?? 0,
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
    if (dto.icon != null) patch.icon = dto.icon;
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
  async listReports() {
    const rows = await this.reports.find({
      where: { status: 'open' },
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

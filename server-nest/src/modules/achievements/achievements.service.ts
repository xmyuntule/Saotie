import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Answer,
  Circle,
  Comment,
  Follow,
  Like,
  PollVote,
  Post,
  TaskClaim,
  User,
  UserBadge,
} from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { SiteService } from '../site/site.service';

interface TaskDef {
  key: string;
  type: string;
  enabled: boolean;
  title: string;
  desc: string;
  icon: string;
  points: number;
  target: number;
  daily: boolean;
  route: string;
  progress: (uid: number) => Promise<number>;
}

interface TaskConfig {
  key: string;
  enabled: boolean;
  title: string;
  desc: string;
  icon: string;
  points: number;
  target: number;
  daily: boolean;
}

interface BadgeDef {
  key: string;
  name: string;
  desc: string;
  icon: string;
  tier: string;
  check: (s: any) => boolean;
}

const TASK_CONFIG_KEY = 'achievement_tasks';
const TASK_ICON_OPTIONS = [
  'checkin', 'edit', 'comment', 'heart', 'poll', 'user', 'users', 'help',
  'forum', 'calendar', 'gift', 'fire', 'spark', 'rocket', 'coin',
];

/**
 * Ported from server/src/routes/achievements.js. Daily/growth tasks (progress
 * derived live), achievement badges (unlock derived from cumulative stats,
 * persisted once), and claim. Response shapes match the Express version.
 * `created_at >= today` comparisons use a JS-computed date string so they are
 * portable across MySQL/Postgres (timestamps are stored as sortable strings).
 */
@Injectable()
export class AchievementsService {
  private readonly tasks: TaskDef[];
  private readonly badges: BadgeDef[];

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
    @InjectRepository(Like) private readonly likes: Repository<Like>,
    @InjectRepository(PollVote)
    private readonly pollVotes: Repository<PollVote>,
    @InjectRepository(Follow) private readonly follows: Repository<Follow>,
    @InjectRepository(Answer) private readonly answers: Repository<Answer>,
    @InjectRepository(Circle) private readonly circles: Repository<Circle>,
    @InjectRepository(UserBadge)
    private readonly userBadges: Repository<UserBadge>,
    @InjectRepository(TaskClaim)
    private readonly taskClaims: Repository<TaskClaim>,
    private readonly helpers: HelpersService,
    private readonly site: SiteService,
  ) {
    const today = () => this.helpers.today();
    const since = today; // 'YYYY-MM-DD' — string-comparable against created_at

    this.tasks = [
      {
        key: 'checkin',
        type: '每日活跃',
        enabled: true,
        title: '每日签到',
        desc: '完成今天的签到',
        icon: 'checkin',
        points: 5,
        target: 1,
        daily: true,
        route: '/member',
        progress: async (uid) => {
          const u = await this.helpers.getUser(uid);
          return u?.last_checkin === today() ? 1 : 0;
        },
      },
      {
        key: 'post',
        type: '内容创作',
        enabled: true,
        title: '发布动态',
        desc: '发布 1 条动态',
        icon: 'edit',
        points: 10,
        target: 1,
        daily: true,
        route: '/',
        progress: (uid) =>
          this.posts
            .createQueryBuilder('p')
            .where('p.user_id = :uid AND p.created_at >= :d', {
              uid,
              d: since(),
            })
            .getCount(),
      },
      {
        key: 'comment',
        type: '互动反馈',
        enabled: true,
        title: '评论互动',
        desc: '评论 3 次',
        icon: 'comment',
        points: 6,
        target: 3,
        daily: true,
        route: '/',
        progress: (uid) =>
          this.comments
            .createQueryBuilder('c')
            .where('c.user_id = :uid AND c.created_at >= :d', {
              uid,
              d: since(),
            })
            .getCount(),
      },
      {
        key: 'like',
        type: '互动反馈',
        enabled: true,
        title: '点赞他人',
        desc: '点赞 5 次',
        icon: 'heart',
        points: 4,
        target: 5,
        daily: true,
        route: '/',
        progress: (uid) =>
          this.likes
            .createQueryBuilder('l')
            .where('l.user_id = :uid AND l.created_at >= :d', {
              uid,
              d: since(),
            })
            .getCount(),
      },
      {
        key: 'vote',
        type: '社区参与',
        enabled: true,
        title: '参与投票',
        desc: '参与 1 次投票',
        icon: 'poll',
        points: 3,
        target: 1,
        daily: true,
        route: '/',
        progress: async (uid) => {
          const row = await this.pollVotes
            .createQueryBuilder('v')
            .select('COUNT(DISTINCT v.poll_id)', 'c')
            .where('v.user_id = :uid AND v.created_at >= :d', {
              uid,
              d: since(),
            })
            .getRawOne();
          return Number(row?.c || 0);
        },
      },
      {
        key: 'follow',
        type: '社交互动',
        enabled: false,
        title: '结识新朋友',
        desc: '关注 1 位用户',
        icon: 'users',
        points: 5,
        target: 1,
        daily: true,
        route: '/discover',
        progress: (uid) =>
          this.follows
            .createQueryBuilder('f')
            .where('f.follower_id = :uid AND f.created_at >= :d', {
              uid,
              d: since(),
            })
            .getCount(),
      },
      {
        key: 'answer',
        type: '社区互助',
        enabled: false,
        title: '答疑解惑',
        desc: '回答 1 个问答',
        icon: 'help',
        points: 8,
        target: 1,
        daily: true,
        route: '/qa',
        progress: (uid) =>
          this.answers
            .createQueryBuilder('a')
            .where('a.user_id = :uid AND a.created_at >= :d', {
              uid,
              d: since(),
            })
            .getCount(),
      },
      {
        key: 'profile',
        type: '账号成长',
        enabled: true,
        title: '完善资料',
        desc: '设置头像和个人简介',
        icon: 'user',
        points: 20,
        target: 1,
        daily: false,
        route: '/settings',
        progress: async (uid) => {
          const u = await this.helpers.getUser(uid);
          return u &&
            u.bio &&
            u.bio.trim() &&
            !u.bio.startsWith('emoji:') &&
            u.avatar
            ? 1
            : 0;
        },
      },
    ];

    this.badges = [
      { key: 'newcomer', name: '初来乍到', desc: '发布第一条动态', icon: 'edit', tier: 'bronze', check: (s) => s.posts >= 1 },
      { key: 'writer', name: '笔耕不辍', desc: '累计发布 20 条动态', icon: 'edit', tier: 'silver', check: (s) => s.posts >= 20 },
      { key: 'voter', name: '热心参与', desc: '累计参与 10 次投票', icon: 'poll', tier: 'bronze', check: (s) => s.votes >= 10 },
      { key: 'checkin7', name: '签到坚持', desc: '连续签到满 7 天', icon: 'checkin', tier: 'silver', check: (s) => s.streak >= 7 },
      { key: 'social', name: '社交达人', desc: '粉丝数达到 50', icon: 'users', tier: 'silver', check: (s) => s.followers >= 50 },
      { key: 'popular', name: '人气作者', desc: '累计获得 200 个赞', icon: 'heart', tier: 'gold', check: (s) => s.likesRecv >= 200 },
      { key: 'helper', name: '乐于助人', desc: '有回答被采纳', icon: 'check', tier: 'gold', check: (s) => s.accepted >= 1 },
      { key: 'founder', name: '圈子主理人', desc: '创建过一个圈子', icon: 'users', tier: 'gold', check: (s) => s.circlesOwned >= 1 },
      { key: 'vip', name: '尊享会员', desc: '开通 VIP 会员', icon: 'shield', tier: 'gold', check: (s) => s.vip },
    ];
  }

  private async userStats(uid: number) {
    const u = await this.helpers.getUser(uid);
    const posts = await this.posts
      .createQueryBuilder('p')
      .where('p.user_id = :uid AND p.share_of IS NULL', { uid })
      .getCount();
    const likesRecvRaw = await this.posts
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.like_count), 0)', 'c')
      .where('p.user_id = :uid', { uid })
      .getRawOne();
    const followers = await this.follows.count({
      where: { following_id: uid },
    });
    const accepted = await this.answers.count({
      where: { user_id: uid, accepted: 1 },
    });
    const circlesOwned = await this.circles.count({
      where: { owner_id: uid },
    });
    const votesRaw = await this.pollVotes
      .createQueryBuilder('v')
      .select('COUNT(DISTINCT v.poll_id)', 'c')
      .where('v.user_id = :uid', { uid })
      .getRawOne();
    const votes = Number(votesRaw?.c || 0);
    return {
      posts,
      likesRecv: Number(likesRecvRaw?.c || 0),
      followers,
      streak: u?.checkin_streak || 0,
      accepted,
      circlesOwned,
      votes,
      vip: !!u?.vip,
    };
  }

  private cleanText(value: any, fallback: string, max: number) {
    const text = typeof value === 'string' ? value.trim() : '';
    return (text || fallback).slice(0, max);
  }

  private clampInt(value: any, fallback: number, min: number, max: number) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(n)));
  }

  private async taskConfigMap() {
    const raw = await this.site.getConfig(TASK_CONFIG_KEY, '');
    if (!raw) return new Map<string, Partial<TaskConfig>>();
    try {
      const parsed = JSON.parse(raw);
      const rows = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.tasks)
          ? parsed.tasks
          : [];
      return new Map<string, Partial<TaskConfig>>(
        rows
          .filter((r: any) => r && typeof r.key === 'string')
          .map((r: any) => [r.key, r]),
      );
    } catch {
      return new Map<string, Partial<TaskConfig>>();
    }
  }

  private applyTaskConfig(def: TaskDef, cfg?: Partial<TaskConfig>): TaskDef {
    const icon = typeof cfg?.icon === 'string' && TASK_ICON_OPTIONS.includes(cfg.icon)
      ? cfg.icon
      : def.icon;
    return {
      ...def,
      enabled: typeof cfg?.enabled === 'boolean' ? cfg.enabled : def.enabled,
      title: this.cleanText(cfg?.title, def.title, 32),
      desc: this.cleanText(cfg?.desc, def.desc, 80),
      icon,
      points: this.clampInt(cfg?.points, def.points, 0, 9999),
      target: this.clampInt(cfg?.target, def.target, 1, 999),
      daily: typeof cfg?.daily === 'boolean' ? cfg.daily : def.daily,
    };
  }

  private taskMeta(t: TaskDef) {
    return {
      key: t.key,
      type: t.type,
      enabled: t.enabled,
      title: t.title,
      desc: t.desc,
      icon: t.icon,
      points: t.points,
      target: t.target,
      daily: !!t.daily,
      route: t.route,
    };
  }

  private async configuredTasks(includeDisabled = false) {
    const cfg = await this.taskConfigMap();
    const tasks = this.tasks.map((t) => this.applyTaskConfig(t, cfg.get(t.key)));
    return includeDisabled ? tasks : tasks.filter((t) => t.enabled);
  }

  async adminTasks() {
    const tasks = await this.configuredTasks(true);
    return {
      tasks: tasks.map((t) => this.taskMeta(t)),
      icons: TASK_ICON_OPTIONS,
    };
  }

  async updateAdminTasks(body: any) {
    if (!Array.isArray(body?.tasks)) {
      throw new BadRequestException('任务配置格式不正确');
    }
    const byKey = new Map<string, Partial<TaskConfig>>(
      body.tasks
        .filter((t: any) => t && typeof t.key === 'string')
        .map((t: any) => [t.key, t]),
    );
    const tasks = this.tasks.map((def) => {
      const t = this.applyTaskConfig(def, byKey.get(def.key));
      return {
        key: t.key,
        enabled: t.enabled,
        title: t.title,
        desc: t.desc,
        icon: t.icon,
        points: t.points,
        target: t.target,
        daily: t.daily,
      };
    });
    await this.site.setConfig(TASK_CONFIG_KEY, JSON.stringify({ tasks }));
    return this.adminTasks();
  }

  async resetAdminTasks() {
    await this.site.setConfig(TASK_CONFIG_KEY, JSON.stringify({ tasks: [] }));
    return this.adminTasks();
  }

  private async evalTasks(uid: number) {
    const day = this.helpers.today();
    const out: any[] = [];
    for (const t of await this.configuredTasks()) {
      const prog = Math.min(Math.max(0, await t.progress(uid)), t.target);
      const slot = t.daily ? day : 'once';
      const claimed = !!(await this.taskClaims.findOne({
        where: { user_id: uid, task_key: t.key, ymd: slot },
      }));
      const done = prog >= t.target;
      out.push({
        key: t.key,
        title: t.title,
        desc: t.desc,
        icon: t.icon,
        type: t.type,
        points: t.points,
        target: t.target,
        daily: !!t.daily,
        route: t.route,
        progress: prog,
        done,
        claimed,
        claimable: done && !claimed,
      });
    }
    return out;
  }

  private async evalBadges(uid: number, { persist = false } = {}) {
    const stats = await this.userStats(uid);
    const ownedRows = await this.userBadges.find({ where: { user_id: uid } });
    const owned = new Map(
      ownedRows.map((r) => [r.badge_key, r.unlocked_at]),
    );
    const out: any[] = [];
    for (const b of this.badges) {
      const unlocked = b.check(stats);
      if (unlocked && persist && !owned.has(b.key)) {
        await this.userBadges
          .createQueryBuilder()
          .insert()
          .into(UserBadge)
          .values({
            user_id: uid,
            badge_key: b.key,
            unlocked_at: this.helpers.nowSql(),
          })
          .orIgnore()
          .execute();
        owned.set(b.key, 'new');
      }
      out.push({
        key: b.key,
        name: b.name,
        desc: b.desc,
        icon: b.icon,
        tier: b.tier,
        unlocked: unlocked || owned.has(b.key),
        unlockedAt: owned.get(b.key) || null,
      });
    }
    return { badges: out, stats };
  }

  // ---- GET /api/achievements ----
  async overview(user: User) {
    const tasks = await this.evalTasks(user.id);
    const { badges, stats } = await this.evalBadges(user.id, { persist: true });
    return {
      tasks,
      badges,
      stats,
      claimablePoints: tasks
        .filter((t) => t.claimable)
        .reduce((a, t) => a + t.points, 0),
      unlockedCount: badges.filter((b) => b.unlocked).length,
    };
  }

  // ---- GET /api/achievements/user/:id/badges ----
  async userBadgeWall(id: number, viewer: User | null) {
    const u = await this.helpers.getUser(id);
    if (!u) throw new NotFoundException('用户不存在');
    const { badges } = await this.evalBadges(u.id, { persist: false });
    return {
      badges,
      user: await this.helpers.publicUser(u, viewer?.id || null),
    };
  }

  // ---- POST /api/achievements/claim/:key ----
  async claim(key: string, user: User) {
    const t = (await this.configuredTasks()).find((x) => x.key === key);
    if (!t) throw new NotFoundException('任务不存在');
    const slot = t.daily ? this.helpers.today() : 'once';
    const claimed = await this.taskClaims.findOne({
      where: { user_id: user.id, task_key: t.key, ymd: slot },
    });
    if (claimed) throw new BadRequestException('该奖励已领取');
    if ((await t.progress(user.id)) < t.target)
      throw new BadRequestException('任务尚未完成');
    await this.taskClaims.insert({
      user_id: user.id,
      task_key: t.key,
      ymd: slot,
      claimed_at: this.helpers.nowSql(),
    });
    await this.helpers.award(user.id, {
      points: t.points,
      reason: `任务奖励：${t.title}`,
      refType: 'task',
      refId: null,
    });
    return {
      ok: true,
      points: t.points,
      user: await this.helpers.publicUser(
        await this.helpers.getUser(user.id),
        user.id,
      ),
    };
  }
}

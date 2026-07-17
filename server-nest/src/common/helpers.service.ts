import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AdminLog, AssetLog, Follow, Notification, Post, User, ViewHistory } from '../database/entities';

/**
 * Ported from server/src/helpers.js. Centralizes the level curve, the public
 * user shape (never leaks password_hash), notifications, exp/points awards,
 * and the @mention / #topic# parsers. Response shapes are byte-for-byte
 * compatible with the Express version so the client works unchanged.
 */
@Injectable()
export class HelpersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Follow) private readonly follows: Repository<Follow>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(ViewHistory)
    private readonly viewHistory: Repository<ViewHistory>,
    @InjectRepository(AdminLog)
    private readonly adminLog: Repository<AdminLog>,
    @InjectRepository(AssetLog)
    private readonly assetLogs: Repository<AssetLog>,
  ) {}

  /** 记录管理操作日志（admin_audit_log）。非关键路径，出错静默吞掉。Mirrors helpers.js logAdmin. */
  async logAdmin(
    adminId: number | null | undefined,
    action: string,
    {
      targetType = '',
      targetId = null,
      detail = '',
    }: { targetType?: string; targetId?: number | null; detail?: string } = {},
  ): Promise<void> {
    if (!adminId) return;
    try {
      await this.adminLog.save(
        this.adminLog.create({
          admin_id: adminId,
          action,
          target_type: targetType,
          target_id: targetId == null ? null : Number(targetId),
          detail: String(detail).slice(0, 300),
          created_at: this.nowSql(),
        }),
      );
    } catch {
      /* audit 非关键，忽略 */
    }
  }

  /** 记录浏览足迹（每用户每内容一行，重复浏览刷新 viewed_at）。未登录则跳过。 */
  async recordView(userId: number | undefined | null, targetType: string, targetId: number) {
    if (!userId) return;
    await this.viewHistory.save(
      this.viewHistory.create({ user_id: userId, target_type: targetType, target_id: targetId, viewed_at: this.nowSql() }),
    );
  }

  // ---- Level curve (experience needed for level L is 30 * (L-1)^1.7) ----
  expForLevel(level: number): number {
    return Math.round(30 * Math.pow(level - 1, 1.7));
  }

  levelFromExp(exp: number): number {
    let lvl = 1;
    while (lvl < 60 && exp >= this.expForLevel(lvl + 1)) lvl++;
    return lvl;
  }

  levelProgress(exp: number) {
    const lvl = this.levelFromExp(exp);
    const cur = this.expForLevel(lvl);
    const next = this.expForLevel(lvl + 1);
    const pct =
      next > cur
        ? Math.min(100, Math.round(((exp - cur) / (next - cur)) * 100))
        : 100;
    return { level: lvl, exp, curLevelExp: cur, nextLevelExp: next, percent: pct };
  }

  effectiveVip(
    u: Pick<User, 'vip' | 'vip_level' | 'vip_expires'> | null | undefined,
    now = new Date(),
  ) {
    const rawLevel = u ? u.vip_level || (u.vip ? 1 : 0) : 0;
    if (!u || !u.vip || rawLevel <= 0)
      return { vip: false, vipLevel: 0, vipExpires: u?.vip_expires || null, expired: false };
    const vipExpires = u.vip_expires || null;
    if (!vipExpires) return { vip: true, vipLevel: rawLevel, vipExpires, expired: false };
    const day = String(vipExpires).slice(0, 10);
    const end = Date.parse(`${day}T23:59:59.999Z`);
    if (!Number.isFinite(end))
      return { vip: true, vipLevel: rawLevel, vipExpires, expired: false };
    const expired = end < now.getTime();
    return { vip: !expired, vipLevel: expired ? 0 : rawLevel, vipExpires, expired };
  }

  vipMultiplier(
    u: Pick<User, 'vip' | 'vip_level' | 'vip_expires'> | null | undefined,
  ): number {
    const level = this.effectiveVip(u).vipLevel;
    if (level >= 3) return 2;
    if (level === 2) return 1.5;
    if (level === 1) return 1.2;
    return 1;
  }

  isAdmin(u: Pick<User, 'role'> | null | undefined): boolean {
    return u?.role === 'admin';
  }

  requireAdmin(
    u: Pick<User, 'role'> | null | undefined,
    message = '无权操作',
  ): void {
    if (!this.isAdmin(u)) throw new ForbiddenException(message);
  }

  canManageOwner(
    u: Pick<User, 'id' | 'role'> | null | undefined,
    ownerId: number | null | undefined,
  ): boolean {
    if (!u || ownerId == null) return false;
    return u.id === Number(ownerId) || this.isAdmin(u);
  }

  requireOwnerOrAdmin(
    u: Pick<User, 'id' | 'role'> | null | undefined,
    ownerId: number | null | undefined,
    message = '无权操作',
  ): void {
    if (!this.canManageOwner(u, ownerId)) throw new ForbiddenException(message);
  }

  effectiveAccess(
    u:
      | Pick<
          User,
          | 'role'
          | 'banned'
          | 'vip'
          | 'vip_level'
          | 'vip_expires'
          | 'experience'
        >
      | null
      | undefined,
  ) {
    const vip = this.effectiveVip(u);
    return {
      admin: this.isAdmin(u),
      banned: !!u?.banned,
      vip: vip.vip,
      vipLevel: vip.vipLevel,
      level: this.levelFromExp(Number(u?.experience || 0)),
    };
  }

  hasVipLevel(
    u:
      | Pick<User, 'role' | 'vip' | 'vip_level' | 'vip_expires'>
      | null
      | undefined,
    minLevel: number,
  ): boolean {
    const required = Math.max(1, Math.round(Number(minLevel) || 0));
    return this.isAdmin(u) || this.effectiveVip(u).vipLevel >= required;
  }

  hasUserGroupAccess(
    u:
      | Pick<
          User,
          | 'role'
          | 'banned'
          | 'vip'
          | 'vip_level'
          | 'vip_expires'
          | 'experience'
        >
      | null
      | undefined,
    group: string,
    opts: { minLevel?: number } = {},
  ): {
    ok: boolean;
    reason: string;
    code: '' | 'guest' | 'banned' | 'admin' | 'vip' | 'vip3' | 'level';
  } {
    if (!u) return { ok: false, reason: '请先登录', code: 'guest' };
    const access = this.effectiveAccess(u);
    if (access.banned)
      return { ok: false, reason: '账号已被封禁', code: 'banned' };

    const normalized = String(group || '').trim().toLowerCase();
    if (normalized === 'admin' && !access.admin)
      return { ok: false, reason: '需要管理员权限', code: 'admin' };
    if (normalized === 'vip' && !access.admin && !access.vip)
      return { ok: false, reason: '需要VIP权限', code: 'vip' };
    if (normalized === 'vip3' && !access.admin && access.vipLevel < 3)
      return { ok: false, reason: '需要VIP3权限', code: 'vip3' };

    const minLevel = Math.max(0, Math.round(Number(opts.minLevel) || 0));
    if (!access.admin && minLevel > 0 && access.level < minLevel)
      return {
        ok: false,
        reason: `账号等级不足，至少需要 Lv.${minLevel}`,
        code: 'level',
      };
    return { ok: true, reason: '', code: '' };
  }

  /** 记录积分 / 余额流水。非关键路径，失败不阻断原业务。 */
  async logAsset(
    userId: number,
    assetType: 'points' | 'balance',
    amount: number,
    reason = '',
    refType = '',
    refId: number | null = null,
    balanceAfter: number | null = null,
    opts: { manager?: EntityManager } = {},
  ): Promise<void> {
    if (!userId || !amount) return;
    try {
      const users = opts.manager?.getRepository(User) || this.users;
      const assetLogs = opts.manager?.getRepository(AssetLog) || this.assetLogs;
      let after = balanceAfter;
      if (after == null) {
        const u = await users.findOne({ where: { id: userId } });
        after =
          assetType === 'points'
            ? u?.points ?? null
            : u?.balance ?? null;
      }
      await assetLogs.insert({
        user_id: userId,
        asset_type: assetType,
        amount: Math.round(Number(amount) || 0),
        balance_after: after == null ? null : Math.round(Number(after) || 0),
        reason: String(reason || '账户变动').slice(0, 160),
        ref_type: String(refType || '').slice(0, 48),
        ref_id: refId == null ? null : Number(refId),
        created_at: this.nowSql(),
      });
    } catch {
      /* asset log 非关键，忽略 */
    }
  }

  /**
   * Single entry for point mutations. It updates the account and writes the
   * asset log together, so feature modules do not need to remember both steps.
   */
  async adjustPoints(
    userId: number,
    amount: number,
    reason = '积分变动',
    refType = '',
    refId: number | null = null,
    opts: { manager?: EntityManager; requireSufficient?: boolean } = {},
  ): Promise<number | null> {
    const delta = Math.round(Number(amount) || 0);
    if (!userId || !delta) {
      const fresh = await this.getUser(userId);
      return fresh?.points ?? null;
    }
    const repo = opts.manager?.getRepository(User) || this.users;
    if (delta < 0 && opts.requireSufficient) {
      const cost = Math.abs(delta);
      const debit = await repo
        .createQueryBuilder()
        .update(User)
        .set({ points: () => `points - ${cost}` })
        .where('id = :id AND points >= :cost', { id: userId, cost })
        .execute();
      if (!debit.affected) return null;
    } else if (delta > 0) {
      await repo.increment({ id: userId }, 'points', delta);
    } else {
      await repo.decrement({ id: userId }, 'points', Math.abs(delta));
    }

    let after: number | null = null;
    try {
      const fresh = await repo.findOne({ where: { id: userId } });
      after = fresh?.points ?? null;
    } catch {
      after = null;
    }
    await this.logAsset(userId, 'points', delta, reason, refType, refId, after, {
      manager: opts.manager,
    });
    return after;
  }

  /** Same account gateway for balance mutations. */
  async adjustBalance(
    userId: number,
    amount: number,
    reason = '余额变动',
    refType = '',
    refId: number | null = null,
    opts: { manager?: EntityManager; requireSufficient?: boolean } = {},
  ): Promise<number | null> {
    const delta = Math.round(Number(amount) || 0);
    if (!userId || !delta) {
      const fresh = await this.getUser(userId);
      return fresh?.balance ?? null;
    }
    const repo = opts.manager?.getRepository(User) || this.users;
    if (delta < 0 && opts.requireSufficient) {
      const cost = Math.abs(delta);
      const debit = await repo
        .createQueryBuilder()
        .update(User)
        .set({ balance: () => `balance - ${cost}` })
        .where('id = :id AND balance >= :cost', { id: userId, cost })
        .execute();
      if (!debit.affected) return null;
    } else if (delta > 0) {
      await repo.increment({ id: userId }, 'balance', delta);
    } else {
      await repo.decrement({ id: userId }, 'balance', Math.abs(delta));
    }

    let after: number | null = null;
    try {
      const fresh = await repo.findOne({ where: { id: userId } });
      after = fresh?.balance ?? null;
    } catch {
      after = null;
    }
    await this.logAsset(userId, 'balance', delta, reason, refType, refId, after, {
      manager: opts.manager,
    });
    return after;
  }

  /** Absolute point correction, mainly for admin adjustments. */
  async setPoints(
    userId: number,
    value: number,
    reason = '积分调整',
    refType = '',
    refId: number | null = null,
    opts: { manager?: EntityManager } = {},
  ): Promise<number | null> {
    const next = Math.max(0, Math.round(Number(value) || 0));
    const repo = opts.manager?.getRepository(User) || this.users;
    const beforeUser = await repo.findOne({ where: { id: userId } });
    if (!beforeUser) return null;
    await repo.update({ id: userId }, { points: next });
    const delta = next - (beforeUser.points || 0);
    if (delta)
      await this.logAsset(userId, 'points', delta, reason, refType, refId, next, {
        manager: opts.manager,
      });
    return next;
  }

  /** Award experience + points (no-op when both zero). */
  async award(
    userId: number,
    {
      exp = 0,
      points = 0,
      reason = '积分奖励',
      refType = '',
      refId = null,
    }: {
      exp?: number;
      points?: number;
      reason?: string;
      refType?: string;
      refId?: number | null;
    } = {},
  ): Promise<void> {
    if (!exp && !points) return;
    if (exp) await this.users.increment({ id: userId }, 'experience', exp);
    if (points) await this.adjustPoints(userId, points, reason, refType, refId);
  }

  getUser(id: number): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  /**
   * Public shape of a user. `viewerId` toggles `isFollowing`.
   * Returns null for a null input (matches helpers.js).
   */
  async publicUser(
    u: User | null,
    viewerId: number | null = null,
  ): Promise<any> {
    if (!u) return null;
    const lp = this.levelProgress(u.experience ?? 0);

    const followers = await this.follows.count({
      where: { following_id: u.id },
    });
    const following = await this.follows.count({
      where: { follower_id: u.id },
    });
    const postCount = await this.posts.count({ where: { user_id: u.id } });

    let isFollowing = false;
    if (viewerId && viewerId !== u.id) {
      isFollowing = !!(await this.follows.findOne({
        where: { follower_id: viewerId, following_id: u.id },
      }));
    }

    const vip = this.effectiveVip(u);
    return {
      id: u.id,
      username: u.username,
      nickname: u.nickname,
      avatar: u.avatar,
      cover: u.cover,
      bio: u.bio,
      gender: u.gender,
      location: u.location,
      verified: !!u.verified,
      verifiedNote: u.verified_note,
      vip: vip.vip,
      vipLevel: vip.vipLevel,
      vipExpires: vip.vipExpires,
      role: u.role,
      banned: !!u.banned,
      title: u.title || '',
      avatarFrame: u.avatar_frame || '',
      points: u.points,
      experience: u.experience,
      balance: u.balance,
      level: lp.level,
      levelProgress: lp,
      checkinStreak: u.checkin_streak,
      lastCheckin: u.last_checkin,
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at,
      followers,
      following,
      postCount,
      isFollowing,
    };
  }

  /** Create a notification (skips self-notifications). */
  async notify({
    userId,
    actorId,
    type,
    targetType = null,
    targetId = null,
    preview = '',
  }: {
    userId: number;
    actorId?: number | null;
    type: string;
    targetType?: string | null;
    targetId?: number | null;
    preview?: string;
  }): Promise<void> {
    if (!userId || userId === actorId) return;
    await this.notifications.insert({
      user_id: userId,
      actor_id: actorId ?? null,
      type,
      target_type: targetType,
      target_id: targetId,
      preview,
    });
  }

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /** Current UTC time as 'YYYY-MM-DD HH:MM:SS' (matches the SQLite datetime('now')). */
  nowSql(): string {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  parseMentions(text: string): string[] {
    const names = [...(text || '').matchAll(/@([一-龥A-Za-z0-9_]{1,20})/g)].map(
      (m) => m[1],
    );
    return [...new Set(names)];
  }

  parseTopics(text: string): string[] {
    const topics = [...(text || '').matchAll(/#([^#\n]{1,30})#/g)].map((m) =>
      m[1].trim(),
    );
    return [...new Set(topics)];
  }
}

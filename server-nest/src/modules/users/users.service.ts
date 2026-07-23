import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetLog, Block, Follow, User, ViewHistory } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { checkSensitive } from '../../common/sensitive';
import { PostsService } from '../posts/posts.service';
import { SiteService } from '../site/site.service';
import { RechargeDto, UpdateProfileDto } from './dto/user.dto';

/**
 * Ported from server/src/routes/users.js. Profile lookups, follow graph,
 * leaderboards, suggestions, mention autocomplete, blocks, bookmarks,
 * profile editing and wallet recharge — JSON shapes match the Express version.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Follow) private readonly follows: Repository<Follow>,
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
    @InjectRepository(ViewHistory)
    private readonly viewHistory: Repository<ViewHistory>,
    @InjectRepository(AssetLog)
    private readonly assetLogs: Repository<AssetLog>,
    private readonly helpers: HelpersService,
    private readonly postsService: PostsService,
    private readonly site: SiteService,
  ) {}

  private async mapPublic(rows: User[], viewerId: number | null) {
    const out: any[] = [];
    for (const u of rows) out.push(await this.helpers.publicUser(u, viewerId));
    return out;
  }

  private async findByHandle(name: string): Promise<User | null> {
    return (
      (await this.users.findOne({ where: { username: name } })) ||
      (await this.users.findOne({ where: { nickname: name } }))
    );
  }

  // ---- GET /api/users/mention ----
  async mention(q: string, viewer: User | null) {
    const query = (q || '').trim();
    let rows: User[];
    if (query) {
      const like = `${query}%`;
      const mid = `%${query}%`;
      rows = await this.users
        .createQueryBuilder('u')
        .where(
          'u.nickname LIKE :like OR u.username LIKE :like OR u.nickname LIKE :mid',
          { like, mid },
        )
        .orderBy(
          'CASE WHEN u.nickname LIKE :like OR u.username LIKE :like THEN 0 ELSE 1 END',
          'ASC',
        )
        .addOrderBy('u.experience', 'DESC')
        .limit(6)
        .getMany();
    } else {
      rows = await this.users.find({
        order: { experience: 'DESC' },
        take: 6,
      });
    }
    return { users: await this.mapPublic(rows, viewer?.id || null) };
  }

  // ---- GET /api/users/me/bookmarks ----
  async myBookmarks(user: User, limit?: any, offset?: any) {
    return this.postsService.bookmarkedPosts(user, limit, offset);
  }

  // ---- POST /api/users/:id/block ----
  async toggleBlock(user: User, targetId: number) {
    if (targetId === user.id)
      throw new BadRequestException('不能拉黑自己');
    if (!(await this.helpers.getUser(targetId)))
      throw new NotFoundException('用户不存在');
    const has = await this.blocks.findOne({
      where: { blocker_id: user.id, blocked_id: targetId },
    });
    if (has) {
      await this.blocks.delete({ blocker_id: user.id, blocked_id: targetId });
      return { blocked: false };
    }
    await this.blocks.insert({
      blocker_id: user.id,
      blocked_id: targetId,
      created_at: this.helpers.nowSql(),
    });
    // remove mutual follows
    await this.follows
      .createQueryBuilder()
      .delete()
      .from(Follow)
      .where(
        '(follower_id = :a AND following_id = :b) OR (follower_id = :b AND following_id = :a)',
        { a: user.id, b: targetId },
      )
      .execute();
    return { blocked: true };
  }

  // ---- GET /api/users/me/blocks ----
  async myBlocks(user: User) {
    const rows: User[] = await this.users
      .createQueryBuilder('u')
      .innerJoin(Block, 'b', 'b.blocked_id = u.id')
      .where('b.blocker_id = :uid', { uid: user.id })
      .orderBy('b.created_at', 'DESC')
      .getMany();
    return { users: await this.mapPublic(rows, user.id) };
  }

  // ---- GET /api/users/:id/blocked ----
  async isBlocked(user: User, targetId: number) {
    const blocked = !!(await this.blocks.findOne({
      where: { blocker_id: user.id, blocked_id: targetId },
    }));
    return { blocked };
  }

  // ---- GET /api/users/ranking/checkin ----
  async rankingCheckin(viewer: User | null) {
    const rows = await this.users.find({
      order: { checkin_streak: 'DESC', experience: 'DESC' },
      take: 10,
    });
    return { users: await this.mapPublic(rows, viewer?.id || null) };
  }

  // ---- GET /api/users/ranking/:type ----
  async ranking(type: string, viewer: User | null) {
    let rows: User[];
    switch (type) {
      case 'wealth':
        rows = await this.users.find({
          order: { points: 'DESC', experience: 'DESC' },
          take: 50,
        });
        break;
      case 'level':
        rows = await this.users.find({
          order: { experience: 'DESC', points: 'DESC' },
          take: 50,
        });
        break;
      case 'fans':
        rows = await this.users
          .createQueryBuilder('u')
          .orderBy(
            '(SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id)',
            'DESC',
          )
          .addOrderBy('u.experience', 'DESC')
          .limit(50)
          .getMany();
        break;
      case 'checkin':
        rows = await this.users.find({
          order: { checkin_streak: 'DESC', experience: 'DESC' },
          take: 50,
        });
        break;
      default:
        throw new BadRequestException('未知榜单');
    }
    return { users: await this.mapPublic(rows, viewer?.id || null) };
  }

  // ---- GET /api/users/suggestions ----
  async suggestions(viewer: User | null, options: { sort?: any; limit?: any } = {}) {
    const me = viewer?.id || 0;
    const sort = ['experience', 'points', 'followers', 'newest', 'random'].includes(String(options.sort))
      ? String(options.sort)
      : 'experience';
    const limit = [5, 10].includes(Number(options.limit)) ? Number(options.limit) : 5;
    const query = () => this.users
      .createQueryBuilder('u')
      .where('u.id != :me', { me })
      .andWhere('u.banned = 0')
      .andWhere(
        'u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = :me)',
        { me },
      );

    let rows: User[];
    if (sort === 'random') {
      // Pick a rotating id window instead of ORDER BY RAND(), which does not scale on a large users table.
      const range = await query()
        .select('MIN(u.id)', 'minId')
        .addSelect('MAX(u.id)', 'maxId')
        .getRawOne();
      const minId = Number(range?.minId || 0);
      const maxId = Number(range?.maxId || 0);
      if (!minId || !maxId) return { users: [] };
      const span = Math.max(1, maxId - minId + 1);
      const window = Math.floor(Date.now() / (15 * 60 * 1000));
      const startId = minId + ((window * 1103515245 + me * 12345) >>> 0) % span;
      rows = await query().andWhere('u.id >= :startId', { startId }).orderBy('u.id', 'ASC').limit(limit).getMany();
      if (rows.length < limit) {
        const tail = await query().andWhere('u.id < :startId', { startId }).orderBy('u.id', 'ASC').limit(limit - rows.length).getMany();
        rows = [...rows, ...tail];
      }
      for (let i = rows.length - 1; i > 0; i -= 1) {
        const j = (window + me + i * 17) % (i + 1);
        [rows[i], rows[j]] = [rows[j], rows[i]];
      }
    } else {
      const qb = query();
      if (sort === 'points') qb.orderBy('u.points', 'DESC').addOrderBy('u.experience', 'DESC');
      else if (sort === 'followers') {
        qb.addSelect(
          '(SELECT COUNT(*) FROM follows suggestion_follow WHERE suggestion_follow.following_id = u.id)',
          'followersCount',
        ).orderBy('followersCount', 'DESC').addOrderBy('u.experience', 'DESC');
      } else if (sort === 'newest') qb.orderBy('u.created_at', 'DESC').addOrderBy('u.id', 'DESC');
      else qb.orderBy('u.experience', 'DESC').addOrderBy('u.id', 'DESC');
      rows = await qb.limit(limit).getMany();
    }
    return { users: await this.mapPublic(rows, viewer?.id || null) };
  }

  // ---- GET /api/users/me/invites —— 我的邀请码 + 战绩 ----
  async meInvites(user: User) {
    const rows = await this.users.find({
      where: { invited_by: user.id },
      order: { id: 'DESC' },
      take: 50,
    });
    const invitees = await this.mapPublic(rows, user.id);
    return {
      code: user.username, // 邀请码即用户名；邀请链接 = 站点地址 ?invite=用户名
      count: rows.length,
      rewardPerInvite: 50, // 每邀请一人得 50 积分
      invitees,
    };
  }

  // ---- GET /api/users/me/stats —— 主页数据(获赞/浏览/访客/收到评论) ----
  async meStats(user: User) {
    const uid = user.id;
    const one = async (sql: string, params: any[]) => {
      const rows = await this.users.manager.query(sql, params);
      const r = rows?.[0] || {};
      return Number(r.s ?? r.c ?? 0) || 0;
    };
    const likes =
      (await one('SELECT COALESCE(SUM(like_count),0) s FROM posts WHERE user_id=?', [uid])) +
      (await one('SELECT COALESCE(SUM(like_count),0) s FROM threads WHERE user_id=?', [uid]));
    const views =
      (await one('SELECT COALESCE(SUM(views),0) s FROM posts WHERE user_id=?', [uid])) +
      (await one('SELECT COALESCE(SUM(views),0) s FROM threads WHERE user_id=?', [uid]));
    const visitors = await one(
      "SELECT COUNT(*) c FROM view_history WHERE target_type='profile' AND target_id=?",
      [uid],
    );
    const comments = await one(
      'SELECT COUNT(*) c FROM comments WHERE post_id IN (SELECT id FROM posts WHERE user_id=?) OR thread_id IN (SELECT id FROM threads WHERE user_id=?)',
      [uid, uid],
    );
    return { likes, views, visitors, comments };
  }

  // ---- GET /api/users/me/assets —— 我的积分 / 余额流水（月度查询）----
  async meAssets(user: User, query: { month?: string; offset?: any; limit?: any } = {}) {
    const fresh = await this.helpers.getUser(user.id);
    const currentMonth = this.helpers.nowSql().slice(0, 7);
    const requestedMonth = String(query.month || currentMonth).slice(0, 7);
    const month = /^\d{4}-\d{2}$/.test(requestedMonth)
      ? requestedMonth
      : currentMonth;
    const offset = Math.max(0, Number(query.offset) || 0);
    const limit = Math.max(10, Math.min(100, Number(query.limit) || 50));
    const rows = await this.assetLogs
      .createQueryBuilder('l')
      .where('l.user_id = :uid', { uid: user.id })
      .andWhere('l.created_at LIKE :month', { month: `${month}%` })
      .orderBy('l.id', 'DESC')
      .offset(offset)
      .limit(limit + 1)
      .getMany();
    const hasMore = rows.length > limit;
    const logs = hasMore ? rows.slice(0, limit) : rows;
    const rawMonths = await this.assetLogs
      .createQueryBuilder('l')
      .select('SUBSTRING(l.created_at, 1, 7)', 'month')
      .addSelect('COUNT(*)', 'count')
      .where('l.user_id = :uid', { uid: user.id })
      .groupBy('SUBSTRING(l.created_at, 1, 7)')
      .orderBy('SUBSTRING(l.created_at, 1, 7)', 'DESC')
      .getRawMany();
    const months = rawMonths.map((r: any) => ({
      month: r.month,
      count: Number(r.count || 0),
    }));
    if (!months.some((m) => m.month === currentMonth))
      months.unshift({ month: currentMonth, count: 0 });
    return {
      user: await this.helpers.publicUser(fresh, user.id),
      month,
      months,
      hasMore,
      logs: logs.map((l) => ({
        id: l.id,
        type: l.asset_type,
        amount: l.amount,
        balanceAfter: l.balance_after,
        reason: l.reason,
        refType: l.ref_type,
        refId: l.ref_id,
        createdAt: l.created_at,
      })),
    };
  }

  // ---- GET /api/users/:username ----
  async profile(username: string, viewer: User | null) {
    const u = await this.findByHandle(username);
    if (!u) throw new NotFoundException('用户不存在');
    // 记录访客足迹(不计自看)。Mirrors Express profile GET。
    if (viewer && viewer.id !== u.id)
      await this.helpers.recordView(viewer.id, 'profile', u.id);
    return { user: await this.helpers.publicUser(u, viewer?.id || null) };
  }

  // ---- GET /api/users/:username/visitors —— 最近访客(仅本人可看) ----
  async visitors(username: string, viewer: User | null) {
    const u = await this.findByHandle(username);
    if (!u) throw new NotFoundException('用户不存在');
    if (!viewer || u.id !== viewer.id)
      throw new ForbiddenException('只能查看自己的访客记录');
    const rows = await this.viewHistory.find({
      where: { target_type: 'profile', target_id: u.id },
      order: { viewed_at: 'DESC' },
      take: 30,
    });
    const visitors: any[] = [];
    for (const r of rows) {
      const v = await this.helpers.getUser(r.user_id);
      if (v)
        visitors.push({
          ...(await this.helpers.publicUser(v, u.id)),
          visitedAt: r.viewed_at,
        });
    }
    const total = await this.viewHistory.count({
      where: { target_type: 'profile', target_id: u.id },
    });
    return { visitors, total };
  }

  // ---- GET /api/users/:username/:rel (followers|following) ----
  async relations(username: string, rel: string, viewer: User | null) {
    const u = await this.findByHandle(username);
    if (!u) throw new NotFoundException('用户不存在');
    let rows: User[];
    if (rel === 'followers') {
      rows = await this.users
        .createQueryBuilder('u')
        .innerJoin(Follow, 'f', 'f.follower_id = u.id')
        .where('f.following_id = :id', { id: u.id })
        .orderBy('f.created_at', 'DESC')
        .getMany();
    } else {
      rows = await this.users
        .createQueryBuilder('u')
        .innerJoin(Follow, 'f', 'f.following_id = u.id')
        .where('f.follower_id = :id', { id: u.id })
        .orderBy('f.created_at', 'DESC')
        .getMany();
    }
    return { users: await this.mapPublic(rows, viewer?.id || null) };
  }

  // ---- POST /api/users/:id/follow ----
  async toggleFollow(user: User, targetId: number) {
    if (targetId === user.id)
      throw new BadRequestException('不能关注自己');
    const target = await this.helpers.getUser(targetId);
    if (!target) throw new NotFoundException('用户不存在');
    const existing = await this.follows.findOne({
      where: { follower_id: user.id, following_id: targetId },
    });
    if (existing) {
      await this.follows.delete({
        follower_id: user.id,
        following_id: targetId,
      });
      return {
        following: false,
        user: await this.helpers.publicUser(
          await this.helpers.getUser(targetId),
          user.id,
        ),
      };
    }
    await this.follows.insert({
      follower_id: user.id,
      following_id: targetId,
      created_at: this.helpers.nowSql(),
    });
    await this.helpers.notify({
      userId: targetId,
      actorId: user.id,
      type: 'follow',
      targetType: 'user',
      targetId: user.id,
    });
    return {
      following: true,
      user: await this.helpers.publicUser(
        await this.helpers.getUser(targetId),
        user.id,
      ),
    };
  }

  // ---- PUT /api/users/me/profile ----
  async updateProfile(user: User, dto: UpdateProfileDto) {
    const nextNickname =
      dto.nickname == null ? null : String(dto.nickname).trim();
    if (nextNickname != null && nextNickname !== user.nickname)
      throw new ForbiddenException('修改昵称需要使用「改名卡」');
    if (checkSensitive(dto.bio))
      throw new BadRequestException('签名包含敏感信息，请修改后重试');
    const patch: Partial<User> = { updated_at: this.helpers.nowSql() };
    if (dto.bio != null) patch.bio = dto.bio;
    if (dto.gender != null) patch.gender = dto.gender;
    if (dto.location != null) patch.location = dto.location;
    if (dto.avatar != null) patch.avatar = dto.avatar;
    if (dto.cover != null) patch.cover = dto.cover;
    if (dto.verifiedNote != null) patch.verified_note = dto.verifiedNote;
    await this.users.update({ id: user.id }, patch);
    const fresh = await this.helpers.getUser(user.id);
    return { user: await this.helpers.publicUser(fresh, user.id) };
  }

  // ---- POST /api/users/me/recharge ----
  async recharge(user: User, dto: RechargeDto) {
    // 演示充值开关：默认关（未配置视为关）。只有后台明确开启时才允许模拟充值/开通会员。
    // 防止正式收款上线后用户因漏配开关而免费获取余额/会员（绕过 /pay 网关）。
    const demoOn =
      (await this.site.getConfig('demo_recharge_enabled', '0')) === '1';
    if (!demoOn)
      throw new ForbiddenException('演示充值已关闭，请通过支付渠道充值');
    const amount = Math.max(0, Math.min(100000, Number(dto?.amount) || 0));
    // 多等级：新前端传 vipLevel(1青铜/2黄金/3黑钻)；兼容旧前端 vip:true(=青铜1)
    let reqLevel = Math.max(0, Math.min(3, parseInt(String(dto?.vipLevel), 10) || 0));
    if (!reqLevel && dto?.vip) reqLevel = 1;
    const currentVip = this.helpers.effectiveVip(user);
    let vipExpires = currentVip.vipExpires;
    let vipLevel = currentVip.vipLevel;
    let vipFlag = currentVip.vip ? 1 : 0;
    if (reqLevel > 0) {
      const base = currentVip.vip && user.vip_expires ? new Date(user.vip_expires) : new Date();
      base.setMonth(base.getMonth() + 1);
      vipExpires = base.toISOString().slice(0, 10);
      vipLevel = reqLevel;
      vipFlag = 1;
    }
    await this.users.update(
      { id: user.id },
      {
        vip: vipFlag,
        vip_level: vipLevel,
        vip_expires: vipExpires,
      },
    );
    if (amount > 0)
      await this.helpers.adjustBalance(
        user.id,
        amount,
        '模拟余额充值',
        'demo_recharge',
        null,
      );
    if (reqLevel > 0) {
      const NAMES: Record<number, string> = { 1: '青铜会员', 2: '黄金会员', 3: '黑钻会员' };
      await this.helpers.notify({
        userId: user.id,
        actorId: null,
        type: 'system',
        preview: `你已开通${NAMES[reqLevel]}，尊享专属特权 🎉`,
      });
    }
    const fresh = await this.helpers.getUser(user.id);
    return { user: await this.helpers.publicUser(fresh, user.id) };
  }
}

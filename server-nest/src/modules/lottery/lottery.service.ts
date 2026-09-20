import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { LotteryDraw, LotteryPrize, User } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';

const COST = 88; // points per paid draw
const FREE_PER_DAY = 1;

/** Ported from server/src/routes/lottery.js — 幸运抽奖(8 格转盘, 加权随机). */
@Injectable()
export class LotteryService {
  constructor(
    @InjectRepository(LotteryPrize) private readonly prizes: Repository<LotteryPrize>,
    @InjectRepository(LotteryDraw) private readonly draws: Repository<LotteryDraw>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly helpers: HelpersService,
  ) {}

  private serialize(p: LotteryPrize) {
    return { id: p.id, name: p.name, type: p.type, value: p.value, icon: p.icon, color: p.color, position: p.position };
  }

  private drawsTodayCount(uid: number) {
    return this.draws.count({
      where: { user_id: uid, created_at: MoreThanOrEqual(`${this.helpers.today()} 00:00:00`) },
    });
  }

  // GET /api/lottery — 转盘状态
  async board(user: User | null) {
    const list = await this.prizes.find({ order: { position: 'ASC', id: 'ASC' } });
    const uid = user?.id;
    const drawsToday = uid ? await this.drawsTodayCount(uid) : 0;
    const myRecent = uid
      ? await this.draws.find({
          where: { user_id: uid },
          order: { id: 'DESC' },
          take: 10,
          select: ['id', 'prize_name', 'prize_type', 'created_at'],
        })
      : [];
    const fresh = uid ? await this.helpers.getUser(uid) : null;
    return {
      prizes: list.map((p) => this.serialize(p)),
      cost: COST,
      freePerDay: FREE_PER_DAY,
      drawsToday,
      freeLeft: Math.max(0, FREE_PER_DAY - drawsToday),
      points: fresh ? fresh.points : 0,
      myRecent,
    };
  }

  // ===== 管理员：抽奖奖品配置（含 weight 概率权重，前台不暴露）=====
  async adminList(user: User) {
    this.helpers.requireAdmin(user);
    const list = await this.prizes.find({ order: { position: 'ASC', id: 'ASC' } });
    return {
      prizes: list.map((p) => ({
        id: p.id, name: p.name, type: p.type, value: p.value,
        icon: p.icon, color: p.color, weight: p.weight, position: p.position,
      })),
    };
  }

  // GET /api/lottery/admin/draws —— 管理员查看抽奖记录(近50) + 按奖品类型汇总
  async adminDraws(user: User) {
    this.helpers.requireAdmin(user);
    const rows = await this.draws.find({ order: { id: 'DESC' }, take: 50 });
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const us = ids.length ? await this.users.find({ where: { id: In(ids) } }) : [];
    const umap = new Map(us.map((u) => [u.id, u]));
    const grp = await this.draws
      .createQueryBuilder('d')
      .select('d.prize_type', 'type')
      .addSelect('COUNT(*)', 'n')
      .groupBy('d.prize_type')
      .getRawMany();
    const byType: Record<string, number> = {};
    let total = 0;
    for (const g of grp) { const n = Number(g.n) || 0; byType[g.type || ''] = n; total += n; }
    const realWins = total - (byType['thanks'] || 0);
    return {
      stats: { total, realWins, byType },
      draws: rows.map((r) => {
        const u = umap.get(r.user_id);
        return {
          id: r.id,
          prizeName: r.prize_name,
          prizeType: r.prize_type,
          createdAt: r.created_at,
          user: u ? { id: u.id, nickname: u.nickname, username: u.username } : null,
        };
      }),
    };
  }

  async upsertPrize(user: User, dto: any) {
    this.helpers.requireAdmin(user);
    const name = (dto?.name || '').trim();
    if (!name) throw new BadRequestException('奖品名必填');
    const TYPES = ['points', 'title', 'frame', 'thanks'];
    const patch = {
      name: name.slice(0, 64),
      type: TYPES.includes(dto.type) ? dto.type : 'thanks',
      value: String(dto.value ?? '').slice(0, 128),
      icon: (dto.icon || 'gift').slice(0, 32),
      color: String(dto.color ?? '').slice(0, 32),
      weight: Math.max(0, Math.min(100000, Math.round(Number(dto.weight) || 0))),
      position: Math.max(0, Math.round(Number(dto.position) || 0)),
    };
    if (dto.id) {
      await this.prizes.update({ id: Number(dto.id) }, patch);
      return { ok: true, id: Number(dto.id) };
    }
    const saved = await this.prizes.save(this.prizes.create(patch));
    return { ok: true, id: saved.id };
  }

  async removePrize(user: User, id: number) {
    this.helpers.requireAdmin(user);
    await this.prizes.delete({ id });
    return { ok: true };
  }

  // GET /api/lottery/winners — 社区中奖滚动(排除谢谢参与)
  async winners() {
    const rows = await this.draws.find({
      where: {},
      order: { id: 'DESC' },
      take: 50,
    });
    const filtered = rows.filter((r) => r.prize_type !== 'thanks').slice(0, 12);
    const out = await Promise.all(
      filtered.map(async (r) => ({
        id: r.id,
        prizeName: r.prize_name,
        createdAt: r.created_at,
        user: await this.helpers.publicUser(await this.helpers.getUser(r.user_id), null),
      })),
    );
    return { winners: out };
  }

  // POST /api/lottery/draw — 抽一次(加权), 每日首抽免费, 其余扣 COST
  async draw(user: User) {
    const list = await this.prizes.find();
    if (!list.length) throw new BadRequestException('奖池未配置');
    const total = list.reduce((s, p) => s + Math.max(0, p.weight), 0);
    if (total <= 0) throw new BadRequestException('奖池概率尚未配置');

    const result = await this.users.manager.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const draws = manager.getRepository(LotteryDraw);
      const current = await users
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.id = :id', { id: user.id })
        .getOne();
      if (!current) throw new BadRequestException('用户不存在');

      const drawsToday = await draws.count({
        where: {
          user_id: user.id,
          created_at: MoreThanOrEqual(`${this.helpers.today()} 00:00:00`),
        },
      });
      const isFree = drawsToday < FREE_PER_DAY;

      let r = Math.random() * total;
      let picked = list[list.length - 1];
      for (const p of list) {
        r -= Math.max(0, p.weight);
        if (r <= 0) {
          picked = p;
          break;
        }
      }

      const draw = await draws.save(draws.create({
        user_id: user.id,
        prize_id: picked.id,
        prize_name: picked.name,
        prize_type: picked.type,
        created_at: this.helpers.nowSql(),
      }));
      if (!isFree) {
        const after = await this.helpers.adjustPoints(
          user.id,
          -COST,
          '幸运抽奖消耗',
          'lottery_draw',
          draw.id,
          { manager, requireSufficient: true },
        );
        if (after === null)
          throw new BadRequestException(`积分不足，每次抽奖需 ${COST} 积分`);
      }

      const patch: Partial<User> = {};
      if (picked.type === 'title') patch.title = picked.value;
      else if (picked.type === 'frame') patch.avatar_frame = picked.value;
      if (Object.keys(patch).length) await users.update({ id: user.id }, patch);

      const wonPoints = picked.type === 'points' ? Number(picked.value) || 0 : 0;
      if (wonPoints > 0) {
        await this.helpers.adjustPoints(
          user.id,
          wonPoints,
          `幸运抽奖中奖：${picked.name}`,
          'lottery_draw',
          draw.id,
          { manager },
        );
      }
      return { picked, isFree, drawsAfter: drawsToday + 1 };
    });

    const fresh = await this.helpers.getUser(user.id);
    return {
      prize: this.serialize(result.picked),
      wasFree: result.isFree,
      user: await this.helpers.publicUser(fresh, user.id),
      freeLeft: Math.max(0, FREE_PER_DAY - result.drawsAfter),
    };
  }
}

import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, MoreThan, Repository } from 'typeorm';
import { CheckinLog, User } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { SiteService } from '../site/site.service';

// 每日奖励 = 基础分 + min(连签天数, 上限)。基础分/上限/补签成本均后台可配(site_config)。
const dayReward = (streakDay: number, base: number, cap: number) => base + Math.min(streakDay, cap);

/** Ported from server/src/routes/checkin.js — 签到中心(hub) + 补签. 签到 mutation 在 auth.checkin. */
@Injectable()
export class CheckinService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CheckinLog) private readonly log: Repository<CheckinLog>,
    private readonly helpers: HelpersService,
    private readonly site: SiteService,
  ) {}

  /** 读签到配置(后台可调)：基础分 / 连签加成上限 / 补签成本。 */
  private async cfg() {
    const num = async (k: string, def: number) => {
      const v = await this.site.getConfig(k);
      return v === null || v === '' ? def : Number(v);
    };
    return {
      base: await num('checkin_base_points', 5),
      cap: await num('checkin_streak_cap', 7),
      makeupCost: await num('checkin_makeup_cost', 20),
    };
  }

  private async topStreakers() {
    const rows = await this.users.find({
      where: { checkin_streak: MoreThan(0) },
      order: { checkin_streak: 'DESC', last_checkin: 'DESC' },
      take: 8,
    });
    return Promise.all(
      rows.map(async (u) => ({
        user: await this.helpers.publicUser(u, null),
        streak: u.checkin_streak || 0,
      })),
    );
  }

  private rewardTrack(streak: number, checkedToday: boolean, continues: boolean, base: number, cap: number) {
    const reached = checkedToday || continues ? streak : 0;
    const doneCount = Math.min(reached, 7);
    const todayDay = checkedToday ? Math.min(streak, 7) : Math.min(reached + 1, 7);
    return Array.from({ length: 7 }, (_, i) => {
      const day = i + 1;
      const state = day <= doneCount ? 'done' : day === todayDay ? 'today' : 'locked';
      return { day, points: dayReward(day, base, cap), state, isToday: day === todayDay };
    });
  }

  // GET /api/checkin
  async hub(user: User | null) {
    const t = this.helpers.today();
    const { base, cap, makeupCost } = await this.cfg();
    if (!user) {
      return {
        authed: false,
        todayDate: t,
        makeupCost,
        rewards: this.rewardTrack(0, false, false, base, cap),
        topStreakers: await this.topStreakers(),
      };
    }
    const u = (await this.helpers.getUser(user.id))!; // 已认证, 必存在
    const checkedToday = u.last_checkin === t;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const continues = u.last_checkin === yesterday;
    const streak = u.checkin_streak || 0;
    const ym = t.slice(0, 7);

    const monthRows = await this.log.find({
      where: { user_id: u.id, date: Like(`${ym}-%`) },
      order: { date: 'ASC' },
    });
    const monthDays = monthRows.map((r) => ({ day: Number(r.date.slice(8, 10)), makeup: !!r.makeup }));
    const totalDays = await this.log.count({ where: { user_id: u.id } });

    return {
      authed: true,
      todayDate: t,
      checkedToday,
      streak: checkedToday ? streak : continues ? streak : 0,
      bestStreak: u.best_checkin_streak || 0,
      points: u.points,
      todayReward: dayReward(checkedToday ? streak : continues ? streak + 1 : 1, base, cap),
      monthDays,
      monthCount: monthRows.length,
      totalDays,
      makeupCost,
      rewards: this.rewardTrack(streak, checkedToday, continues, base, cap),
      topStreakers: await this.topStreakers(),
    };
  }

  // POST /api/checkin/makeup —— 补签当月某天(不计入连签)
  async makeup(user: User, rawDate: any) {
    const date = String(rawDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('日期无效');
    const t = this.helpers.today();
    if (date >= t) throw new BadRequestException('只能补签今天之前的日期');
    if (date.slice(0, 7) !== t.slice(0, 7)) throw new BadRequestException('只能补签本月的日期');
    if (await this.log.findOne({ where: { user_id: user.id, date } }))
      throw new BadRequestException('这一天已经签到过啦');
    const u = (await this.helpers.getUser(user.id))!; // 已认证, 必存在
    const { makeupCost } = await this.cfg();
    if (u.points < makeupCost) throw new BadRequestException(`积分不足，补签需 ${makeupCost} 积分`);

    await this.users.update({ id: user.id }, { points: u.points - makeupCost });
    await this.helpers.logAsset(
      user.id,
      'points',
      -makeupCost,
      `补签扣费：${date}`,
      'checkin_makeup',
      null,
      u.points - makeupCost,
    );
    await this.log
      .createQueryBuilder()
      .insert()
      .into(CheckinLog)
      .values({ user_id: user.id, date, points: 0, makeup: 1 })
      .orIgnore()
      .execute();
    const fresh = await this.helpers.getUser(user.id);
    return { ok: true, date, cost: makeupCost, user: await this.helpers.publicUser(fresh, user.id) };
  }

  // GET /api/checkin/admin/stats —— 管理员：签到统计(今日/总计/参与人数 + 连签榜)
  async adminStats(user: User) {
    if (user.role !== 'admin') throw new ForbiddenException('无权操作');
    const today = this.helpers.today();
    const todayCount = await this.log.count({ where: { date: today } });
    const totalCheckins = await this.log.count();
    const pRaw = await this.log
      .createQueryBuilder('l')
      .select('COUNT(DISTINCT l.user_id)', 'n')
      .getRawOne();
    const participants = Number(pRaw?.n || 0);
    return {
      stats: { todayCount, totalCheckins, participants },
      topStreakers: await this.topStreakers(),
    };
  }
}

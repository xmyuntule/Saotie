import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, MoreThan, Repository } from 'typeorm';
import { CheckinLog, User } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';

const MAKEUP_COST = 20;
const dayReward = (streakDay: number) => 5 + Math.min(streakDay, 7);

/** Ported from server/src/routes/checkin.js — 签到中心(hub) + 补签. 签到 mutation 在 auth.checkin. */
@Injectable()
export class CheckinService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CheckinLog) private readonly log: Repository<CheckinLog>,
    private readonly helpers: HelpersService,
  ) {}

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

  private rewardTrack(streak: number, checkedToday: boolean, continues: boolean) {
    const reached = checkedToday || continues ? streak : 0;
    const doneCount = Math.min(reached, 7);
    const todayDay = checkedToday ? Math.min(streak, 7) : Math.min(reached + 1, 7);
    return Array.from({ length: 7 }, (_, i) => {
      const day = i + 1;
      const state = day <= doneCount ? 'done' : day === todayDay ? 'today' : 'locked';
      return { day, points: dayReward(day), state, isToday: day === todayDay };
    });
  }

  // GET /api/checkin
  async hub(user: User | null) {
    const t = this.helpers.today();
    if (!user) {
      return {
        authed: false,
        todayDate: t,
        makeupCost: MAKEUP_COST,
        rewards: this.rewardTrack(0, false, false),
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
      todayReward: dayReward(checkedToday ? streak : continues ? streak + 1 : 1),
      monthDays,
      monthCount: monthRows.length,
      totalDays,
      makeupCost: MAKEUP_COST,
      rewards: this.rewardTrack(streak, checkedToday, continues),
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
    if (u.points < MAKEUP_COST) throw new BadRequestException(`积分不足，补签需 ${MAKEUP_COST} 积分`);

    await this.users.update({ id: user.id }, { points: u.points - MAKEUP_COST });
    await this.log
      .createQueryBuilder()
      .insert()
      .into(CheckinLog)
      .values({ user_id: user.id, date, points: 0, makeup: 1 })
      .orIgnore()
      .execute();
    const fresh = await this.helpers.getUser(user.id);
    return { ok: true, date, cost: MAKEUP_COST, user: await this.helpers.publicUser(fresh, user.id) };
  }
}

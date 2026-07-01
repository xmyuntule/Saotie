import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { CheckinService } from '../src/modules/checkin/checkin.service';

// rewardTrack() 是签到中心「连签 7 天奖励条」的纯逻辑（无 DB 依赖）：给定 streak / 今日是否已签 /
// 是否延续昨日，算出 7 天每天的 points 与 done/today/locked 状态。它驱动签到页那条奖励条，
// 也内部调用 dayReward = base + min(day, cap)。用 null 依赖实例化 Service（rewardTrack 不碰仓库），
// 通过 (s as any) 调私有方法，锁定核心积分/连签行为，回归防护。
const svc = () => new CheckinService(null as any, null as any, null as any, null as any);
const track = (streak: number, checkedToday: boolean, continues: boolean, base = 5, cap = 7) =>
  (svc() as any).rewardTrack(streak, checkedToday, continues, base, cap) as Array<{
    day: number;
    points: number;
    state: 'done' | 'today' | 'locked';
    isToday: boolean;
  }>;

describe('CheckinService.rewardTrack', () => {
  test('始终返回 7 天，points = base + min(day, cap)（base=5,cap=7 → 6..12）', () => {
    const r = track(0, false, false);
    expect(r).toHaveLength(7);
    expect(r.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(r.map((d) => d.points)).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  test('全新用户（streak=0，未签，不延续）→ 第1天为 today，其余 locked', () => {
    const r = track(0, false, false);
    expect(r.map((d) => d.state)).toEqual(['today', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
    expect(r.filter((d) => d.isToday).map((d) => d.day)).toEqual([1]);
  });

  test('已延续昨日、今日待签（streak=3，continues）→ 前3天 done、第4天 today、其余 locked', () => {
    const r = track(3, false, true);
    expect(r.map((d) => d.state)).toEqual(['done', 'done', 'done', 'today', 'locked', 'locked', 'locked']);
    expect(r.find((d) => d.state === 'today')!.day).toBe(4);
  });

  test('今日已签（streak=3，checkedToday）→ 前3天 done、无 today（当天记为 done），第4天起 locked', () => {
    const r = track(3, true, false);
    expect(r.map((d) => d.state)).toEqual(['done', 'done', 'done', 'locked', 'locked', 'locked', 'locked']);
    expect(r.some((d) => d.state === 'today')).toBe(false);
    // 当天(第3天)虽为 done，isToday 仍标记为 true（行为锁定）
    expect(r[2].isToday).toBe(true);
  });

  test('连签超过 7 天（streak=10，checkedToday）→ 7 天全 done，points 在上限封顶', () => {
    const r = track(10, true, false);
    expect(r.every((d) => d.state === 'done')).toBe(true);
    expect(r[6].points).toBe(12); // 5 + min(7,7)
  });

  test('断签（streak=5 但既未今日签也不延续）→ 归零重启：第1天 today、其余 locked', () => {
    const r = track(5, false, false);
    expect(r.map((d) => d.state)).toEqual(['today', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
    expect(r.filter((d) => d.state === 'done')).toHaveLength(0);
  });

  test('可配置 base/cap：base=10,cap=3 → points 从第3天起封顶在 13', () => {
    const r = track(0, false, false, 10, 3);
    expect(r.map((d) => d.points)).toEqual([11, 12, 13, 13, 13, 13, 13]);
  });

  test('不变量：points 单调不减，且最多一个 today 状态', () => {
    for (const [s, ct, co] of [
      [0, false, false],
      [3, false, true],
      [3, true, false],
      [10, true, false],
      [5, false, false],
    ] as Array<[number, boolean, boolean]>) {
      const r = track(s, ct, co);
      for (let i = 1; i < r.length; i++) expect(r[i].points).toBeGreaterThanOrEqual(r[i - 1].points);
      expect(r.filter((d) => d.state === 'today').length).toBeLessThanOrEqual(1);
    }
  });
});

import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { HelpersService } from '../src/common/helpers.service';

// 等级 / 经验曲线是成长体系（等级榜、会员等级、勋章解锁、个人主页进度条）的核心纯逻辑：
//   expForLevel(L) = round(30 * (L-1)^1.7)，levelFromExp 单调跨级、封顶 60，
//   levelProgress 百分比恒在 [0,100] 且与 levelFromExp 自洽。
// 这三个方法不访问任何 repository，用 null 依赖实例化即可做纯回归（不连数据库、不进 nest build）。
const h = new HelpersService(
  null as any,
  null as any,
  null as any,
  null as any,
  null as any,
  null as any,
);

describe('等级曲线 expForLevel', () => {
  test('1 级=0、2 级=30，且随等级严格递增', () => {
    expect(h.expForLevel(1)).toBe(0);
    expect(h.expForLevel(2)).toBe(30);
    for (let L = 2; L <= 60; L++) {
      expect(h.expForLevel(L)).toBeGreaterThan(h.expForLevel(L - 1));
    }
  });
});

describe('经验反推等级 levelFromExp', () => {
  test('0 / 负数经验兜底为 1 级', () => {
    expect(h.levelFromExp(0)).toBe(1);
    expect(h.levelFromExp(-100)).toBe(1);
  });

  test('在每级阈值处精确跨级（恰好达到升级、差 1 经验不升）', () => {
    for (let L = 2; L <= 30; L++) {
      const threshold = h.expForLevel(L);
      expect(h.levelFromExp(threshold)).toBe(L);
      expect(h.levelFromExp(threshold - 1)).toBe(L - 1);
    }
  });

  test('随经验单调不减', () => {
    let prev = 1;
    for (let exp = 0; exp <= 200000; exp += 137) {
      const lvl = h.levelFromExp(exp);
      expect(lvl).toBeGreaterThanOrEqual(prev);
      prev = lvl;
    }
  });

  test('封顶 60 级（极大经验不溢出）', () => {
    expect(h.levelFromExp(10 ** 9)).toBe(60);
  });
});

describe('等级进度 levelProgress', () => {
  test('百分比恒在 [0,100]，且与 expForLevel / levelFromExp 自洽', () => {
    for (const exp of [0, 1, 29, 30, 96, 97, 500, 5000, 10 ** 9]) {
      const p = h.levelProgress(exp);
      expect(p.level).toBe(h.levelFromExp(exp));
      expect(p.exp).toBe(exp);
      expect(p.percent).toBeGreaterThanOrEqual(0);
      expect(p.percent).toBeLessThanOrEqual(100);
      expect(p.curLevelExp).toBe(h.expForLevel(p.level));
      expect(p.nextLevelExp).toBe(h.expForLevel(p.level + 1));
    }
  });

  test('刚好踏上本级阈值时进度=0', () => {
    const e5 = h.expForLevel(5);
    expect(h.levelProgress(e5).percent).toBe(0);
  });
});

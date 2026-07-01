import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { HelpersService } from '../src/common/helpers.service';

// award() 是积分 / 经验体系的核心写入（签到、任务、点赞、采纳、充值到账都调它）。
// 假 users 仓库记录 increment 调用，回归：两者皆 0 → 完全不写；给了值 → 按列 increment；默认参数。
function svc() {
  const calls: { id: any; column: string; value: number }[] = [];
  const users = {
    increment: async (criteria: any, column: string, value: number) => {
      calls.push({ id: criteria.id, column, value });
    },
  };
  const s = new HelpersService(users as any, null as any, null as any, null as any, null as any, null as any);
  return { s, calls };
}

describe('HelpersService.award', () => {
  test('exp 与 points 皆 0（或缺省）→ 完全不写', async () => {
    const { s, calls } = svc();
    await s.award(1, { exp: 0, points: 0 });
    await s.award(1, {});
    await s.award(1);
    expect(calls).toHaveLength(0);
  });

  test('给了积分与经验 → 两列各 increment，带正确 userId', async () => {
    const { s, calls } = svc();
    await s.award(7, { exp: 10, points: 5 });
    expect(calls).toEqual([
      { id: 7, column: 'experience', value: 10 },
      { id: 7, column: 'points', value: 5 },
    ]);
  });

  test('只给积分：exp 缺省为 0（行为锁定：仍会按 0 递增 experience）', async () => {
    const { s, calls } = svc();
    await s.award(3, { points: 20 });
    expect(calls).toEqual([
      { id: 3, column: 'experience', value: 0 },
      { id: 3, column: 'points', value: 20 },
    ]);
  });

  test('只给经验：points 缺省为 0', async () => {
    const { s, calls } = svc();
    await s.award(3, { exp: 8 });
    expect(calls).toEqual([
      { id: 3, column: 'experience', value: 8 },
      { id: 3, column: 'points', value: 0 },
    ]);
  });
});

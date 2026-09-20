import 'reflect-metadata';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { LotteryDraw, User } from '../src/database/entities';
import { LotteryService } from '../src/modules/lottery/lottery.service';

const PRIZES = [
  { id: 1, name: 'A', type: 'thanks', value: '', weight: 10, position: 1 },
  { id: 2, name: 'B', type: 'points', value: 50, weight: 30, position: 2 },
  { id: 3, name: 'C', type: 'title', value: '幸运星', weight: 60, position: 3 },
];
const COST = 88;

function setup({ prizes = PRIZES, drawsToday = 0, points = 200 } = {}) {
  const state: any = {
    drawsToday,
    points,
    title: '',
    avatarFrame: '',
    updatePatch: null,
    savedDraws: [],
    pointAdjustments: [],
  };

  const drawRepo = {
    count: async () => state.drawsToday,
    create: (value: any) => value,
    save: async (value: any) => {
      const saved = { id: state.savedDraws.length + 1, ...value };
      state.savedDraws.push(saved);
      state.drawsToday += 1;
      return saved;
    },
  };
  const userRepo = {
    createQueryBuilder: () => ({
      setLock() { return this; },
      where() { return this; },
      getOne: async () => ({
        id: 7,
        points: state.points,
        title: state.title,
        avatar_frame: state.avatarFrame,
      }),
    }),
    update: async (_criteria: any, patch: any) => {
      state.updatePatch = patch;
      if (patch.title !== undefined) state.title = patch.title;
      if (patch.avatar_frame !== undefined) state.avatarFrame = patch.avatar_frame;
    },
  };
  const manager: any = {
    getRepository: (entity: any) => entity === User ? userRepo : entity === LotteryDraw ? drawRepo : null,
  };

  let transactionTail = Promise.resolve();
  manager.transaction = <T>(work: (tx: any) => Promise<T>) => {
    const run = transactionTail.then(async () => {
      const snapshot = {
        drawsToday: state.drawsToday,
        points: state.points,
        title: state.title,
        avatarFrame: state.avatarFrame,
        updatePatch: state.updatePatch,
        savedDraws: [...state.savedDraws],
        pointAdjustments: [...state.pointAdjustments],
      };
      try {
        return await work(manager);
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    });
    transactionTail = run.then(() => undefined, () => undefined);
    return run;
  };

  const helpers = {
    getUser: async () => ({
      id: 7,
      points: state.points,
      title: state.title,
      avatar_frame: state.avatarFrame,
    }),
    today: () => '2026-07-02',
    nowSql: () => '2026-07-02 00:00:00',
    publicUser: async (u: any) => ({ id: u.id, points: u.points }),
    adjustPoints: async (
      _uid: number,
      amount: number,
      reason: string,
      refType: string,
      refId: number | null,
      options: any = {},
    ) => {
      if (options.requireSufficient && state.points < Math.abs(amount)) return null;
      state.pointAdjustments.push({ amount, reason, refType, refId, options });
      state.points += amount;
      return state.points;
    },
  };
  const svc = new LotteryService(
    { find: async () => prizes } as any,
    drawRepo as any,
    { manager } as any,
    helpers as any,
  );
  return { svc, state, user: { id: 7 } as any };
}

afterEach(() => vi.restoreAllMocks());

describe('LotteryService.draw - weighted draw and transaction safety', () => {
  test('rejects an empty or zero-weight prize pool', async () => {
    await expect(setup({ prizes: [] }).svc.draw({ id: 7 } as any)).rejects.toThrow('奖池未配置');
    const zeroWeight = [{ id: 1, name: 'X', type: 'thanks', value: '', weight: 0, position: 1 }];
    await expect(setup({ prizes: zeroWeight }).svc.draw({ id: 7 } as any)).rejects.toThrow('奖池概率尚未配置');
  });

  test('selects the expected prize in each cumulative weight interval', async () => {
    const cases: Array<[number, string]> = [
      [0, 'A'],
      [0.05, 'A'],
      [0.25, 'B'],
      [0.7, 'C'],
      [0.999, 'C'],
    ];
    for (const [random, name] of cases) {
      vi.spyOn(Math, 'random').mockReturnValue(random);
      const { svc, user } = setup();
      expect((await svc.draw(user)).prize.name).toBe(name);
      vi.restoreAllMocks();
    }
  });

  test('free draw does not charge points and still settles the prize', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const { svc, state, user } = setup({ drawsToday: 0, points: 200 });
    const result = await svc.draw(user);
    expect(result.wasFree).toBe(true);
    expect(state.points).toBe(250);
    expect(state.pointAdjustments.map((x: any) => x.amount)).toEqual([50]);
    expect(state.savedDraws).toHaveLength(1);
  });

  test('paid draw charges points before settling the prize', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const { svc, state, user } = setup({ drawsToday: 1, points: 200 });
    const result = await svc.draw(user);
    expect(result.wasFree).toBe(false);
    expect(state.points).toBe(200 - COST + 50);
    expect(state.pointAdjustments.map((x: any) => x.amount)).toEqual([-COST, 50]);
    expect(state.pointAdjustments[0].options.requireSufficient).toBe(true);
  });

  test('insufficient points rolls the entire paid draw back', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const { svc, state, user } = setup({ drawsToday: 1, points: 50 });
    await expect(svc.draw(user)).rejects.toThrow(`积分不足，每次抽奖需 ${COST} 积分`);
    expect(state.points).toBe(50);
    expect(state.updatePatch).toBeNull();
    expect(state.savedDraws).toHaveLength(0);
    expect(state.drawsToday).toBe(1);
  });

  test('concurrent first draws consume only one free quota', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    const { svc, state, user } = setup({ drawsToday: 0, points: 200 });
    const results = await Promise.all([svc.draw(user), svc.draw(user)]);
    expect(results.map((result) => result.wasFree)).toEqual([true, false]);
    expect(state.savedDraws).toHaveLength(2);
    expect(state.points).toBe(200 - COST);
    expect(state.pointAdjustments.map((x: any) => x.amount)).toEqual([-COST]);
  });

  test('settles title, frame and no-op prizes correctly', async () => {
    const single = (type: string, value: any) => [
      { id: 1, name: 'X', type, value, weight: 100, position: 1 },
    ];
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    let fixture = setup({ prizes: single('title', '幸运星'), points: 100 });
    await fixture.svc.draw(fixture.user);
    expect(fixture.state.updatePatch.title).toBe('幸运星');
    vi.restoreAllMocks();

    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    fixture = setup({ prizes: single('frame', 'rainbow'), points: 100 });
    await fixture.svc.draw(fixture.user);
    expect(fixture.state.updatePatch.avatar_frame).toBe('rainbow');
    vi.restoreAllMocks();

    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    fixture = setup({ prizes: single('thanks', ''), points: 100 });
    await fixture.svc.draw(fixture.user);
    expect(fixture.state.points).toBe(100);
    expect(fixture.state.updatePatch).toBeNull();
  });
});

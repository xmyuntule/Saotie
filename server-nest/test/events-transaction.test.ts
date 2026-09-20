import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { Event, EventSignup } from '../src/database/entities';
import { EventsService } from '../src/modules/events/events.service';

function setup({ capacity = 1, fee = 0, points = { 1: 100, 2: 100 }, signed = [] as number[] } = {}) {
  const state: any = {
    event: {
      id: 10,
      user_id: 99,
      title: '限额活动',
      cover: '',
      description: '',
      location: '',
      category: '聚会',
      start_at: '2099-01-01 10:00:00',
      end_at: '2099-01-01 12:00:00',
      capacity,
      fee,
      online: 0,
      signup_count: signed.length,
      created_at: '2026-09-20 00:00:00',
    },
    signups: signed.map((userId, index) => ({ id: index + 1, event_id: 10, user_id: userId })),
    points: { ...points },
    adjustments: [] as any[],
  };

  const signupRepo = {
    findOne: async ({ where }: any) => state.signups.find(
      (row: any) => row.event_id === where.event_id && row.user_id === where.user_id,
    ) || null,
    create: (value: any) => value,
    save: async (value: any) => {
      const saved = { id: state.signups.length + 1, ...value };
      state.signups.push(saved);
      return saved;
    },
    delete: async ({ id }: any) => {
      const index = state.signups.findIndex((row: any) => row.id === id);
      if (index < 0) return { affected: 0 };
      state.signups.splice(index, 1);
      return { affected: 1 };
    },
  };
  const eventRepo = {
    findOne: async ({ where }: any) => where.id === state.event.id ? state.event : null,
    increment: async () => { state.event.signup_count += 1; },
    createQueryBuilder: () => ({
      setLock() { return this; },
      where() { return this; },
      getOne: async () => state.event,
      update() { return this; },
      set() { return this; },
      execute: async () => {
        state.event.signup_count = Math.max(0, state.event.signup_count - 1);
        return { affected: 1 };
      },
    }),
  };
  const manager: any = {
    getRepository: (entity: any) => entity === Event ? eventRepo : entity === EventSignup ? signupRepo : null,
  };
  let transactionTail = Promise.resolve();
  const transaction = <T>(work: (tx: any) => Promise<T>) => {
    const run = transactionTail.then(async () => {
      const snapshot = {
        event: { ...state.event },
        signups: state.signups.map((row: any) => ({ ...row })),
        points: { ...state.points },
        adjustments: [...state.adjustments],
      };
      try {
        return await work(manager);
      } catch (error) {
        state.event = snapshot.event;
        state.signups = snapshot.signups;
        state.points = snapshot.points;
        state.adjustments = snapshot.adjustments;
        throw error;
      }
    });
    transactionTail = run.then(() => undefined, () => undefined);
    return run;
  };

  const helpers = {
    nowSql: () => '2026-09-20 00:00:00',
    getUser: async (userId: number) => ({ id: userId, points: state.points[userId] ?? 0 }),
    publicUser: async (value: any) => value,
    notify: async () => undefined,
    adjustPoints: async (
      userId: number,
      amount: number,
      _reason: string,
      _refType: string,
      _refId: number,
      options: any = {},
    ) => {
      const current = state.points[userId] ?? 0;
      if (options.requireSufficient && current < Math.abs(amount)) return null;
      state.points[userId] = current + amount;
      state.adjustments.push({ userId, amount, options });
      return state.points[userId];
    },
  };
  const svc = new EventsService(
    { ...eventRepo, manager: { transaction } } as any,
    signupRepo as any,
    {} as any,
    helpers as any,
  );
  return { svc, state };
}

describe('EventsService signup and cancel transactions', () => {
  test('concurrent signups cannot exceed capacity', async () => {
    const { svc, state } = setup({ capacity: 1 });
    const results = await Promise.allSettled([
      svc.signup({ id: 1 } as any, 10),
      svc.signup({ id: 2 } as any, 10),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason.message).toBe('名额已满');
    expect(state.signups).toHaveLength(1);
    expect(state.event.signup_count).toBe(1);
  });

  test('insufficient points leaves signup and count unchanged', async () => {
    const { svc, state } = setup({ capacity: 5, fee: 10, points: { 1: 5, 2: 100 } });
    await expect(svc.signup({ id: 1 } as any, 10)).rejects.toThrow('积分不足，报名需 10 积分');
    expect(state.signups).toHaveLength(0);
    expect(state.event.signup_count).toBe(0);
    expect(state.points[1]).toBe(5);
  });

  test('concurrent cancellation refunds a signup only once', async () => {
    const { svc, state } = setup({ capacity: 5, fee: 10, points: { 1: 90, 2: 100 }, signed: [1] });
    const results = await Promise.allSettled([
      svc.cancel({ id: 1 } as any, 10),
      svc.cancel({ id: 1 } as any, 10),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(state.signups).toHaveLength(0);
    expect(state.event.signup_count).toBe(0);
    expect(state.points[1]).toBe(100);
    expect(state.adjustments.map((row: any) => row.amount)).toEqual([10]);
  });
});

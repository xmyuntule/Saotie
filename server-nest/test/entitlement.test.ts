import 'reflect-metadata';
import { describe, expect, test, vi } from 'vitest';
import { EntitlementService } from '../src/common/entitlement.service';

const makeQb = (row: any) => {
  const qb: any = {
    innerJoin: vi.fn(() => qb),
    select: vi.fn(() => qb),
    addSelect: vi.fn(() => qb),
    where: vi.fn(() => qb),
    andWhere: vi.fn(() => qb),
    groupBy: vi.fn(() => qb),
    orderBy: vi.fn(() => qb),
    getRawOne: vi.fn(async () => row),
    getRawMany: vi.fn(async () => row),
  };
  return qb;
};

describe('EntitlementService', () => {
  test('globalPinMinutes parses payload and clamps excessive durations', () => {
    const svc = new EntitlementService({} as any, {} as any);
    expect(svc.globalPinMinutes('pin')).toBe(1440);
    expect(svc.globalPinMinutes('pin:30')).toBe(30);
    expect(svc.globalPinMinutes('pin:999999')).toBe(43200);
    expect(svc.globalPinMinutes('pin:bad')).toBe(1440);
  });

  test('inventory groups available item payloads', async () => {
    const qb = makeQb([
      { payload: 'pin:60', c: '2' },
      { payload: 'rename', c: '1' },
    ]);
    const orders = { createQueryBuilder: vi.fn(() => qb) };
    const svc = new EntitlementService(orders as any, {} as any);
    await expect(svc.inventory(7)).resolves.toEqual({
      'pin:60': 2,
      rename: 1,
    });
  });

  test('consumeGlobalPinCard marks the first matching order used', async () => {
    const qb = makeQb({
      orderId: 12,
      productId: 5,
      name: '全站置顶卡',
      category: 'item',
      payload: 'pin:60',
    });
    const orders = {
      createQueryBuilder: vi.fn(() => qb),
      update: vi.fn(async () => ({ affected: 1 })),
    };
    const svc = new EntitlementService(orders as any, {} as any);
    const card = await svc.consumeGlobalPinCard(7);

    expect(card).toMatchObject({ orderId: 12, payload: 'pin:60' });
    expect(orders.update).toHaveBeenCalledWith({ id: 12, used: 0 }, { used: 1 });
    expect(qb.andWhere).toHaveBeenCalledWith(
      '(p.payload = :payloadExact OR p.payload LIKE :payloadPrefix)',
      { payloadExact: 'pin', payloadPrefix: 'pin:%' },
    );
  });

  test('consumeRenameCard returns null when no card exists', async () => {
    const qb = makeQb(null);
    const orders = { createQueryBuilder: vi.fn(() => qb) };
    const svc = new EntitlementService(orders as any, {} as any);
    await expect(svc.consumeRenameCard(7)).resolves.toBeNull();
  });

  test('applyProductBenefit equips title and avatar frame products', async () => {
    const users = { update: vi.fn(async () => undefined) };
    const svc = new EntitlementService({} as any, users as any);

    await svc.applyProductBenefit(7, {
      category: 'title',
      payload: '测试头衔',
    } as any);
    await svc.applyProductBenefit(7, {
      category: 'frame',
      payload: '#00e5ff',
    } as any);

    expect(users.update).toHaveBeenCalledWith({ id: 7 }, { title: '测试头衔' });
    expect(users.update).toHaveBeenCalledWith(
      { id: 7 },
      { avatar_frame: '#00e5ff' },
    );
  });
});

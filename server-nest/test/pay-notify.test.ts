import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { PayService } from '../src/modules/pay/pay.service';

// 支付异步回调 handleEpayNotify 是 money-path 最关键的安全逻辑：验签防伪造、只在 TRADE_SUCCESS 到账、
// 且**幂等**——支付网关可能重复回调，已到账订单绝不能二次发积分(否则真金白银损失)。
// mock 仓库/site/helpers 测「真实」handler(不改源码)；用真实私有 epaySign 造合法签名。
function svc({ order = null as any, key = 'key456' } = {}) {
  const cfg: Record<string, string> = {
    pay_epay_enabled: '1', pay_epay_pid: 'pid', pay_epay_key: key, pay_epay_url: 'https://x/',
  };
  const state = {
    order: order ? { ...order } : null as any,
    updates: [] as any[],
    awards: [] as any[],
    notifies: 0,
  };
  const repo: any = {
    findOne: async ({ where }: any) =>
      state.order?.out_trade_no === where.out_trade_no ? state.order : null,
    update: async (where: any, patch: any) => {
      if (
        !state.order ||
        state.order.id !== where.id ||
        state.order.status !== where.status
      ) return { affected: 0 };
      Object.assign(state.order, patch);
      state.updates.push({ ...patch });
      return { affected: 1 };
    },
  };
  const manager: any = {
    getRepository: () => repo,
    transaction: async (fn: any) => fn(manager),
  };
  repo.manager = manager;
  const s = new PayService(
    repo,
    null as any,
    { getConfig: async (k: string) => (k in cfg ? cfg[k] : null) } as any,
    {
      nowSql: () => '2026-07-02 12:00:00',
      adjustPoints: async (
        uid: number,
        points: number,
        reason: string,
        refType: string,
        refId: number,
        opts: any,
      ) => {
        state.awards.push({ uid, points, reason, refType, refId, manager: opts.manager });
      },
      notify: async () => { state.notifies++; },
    } as any,
  );
  return { s, state };
}
// 用真实 epaySign 给 query 补上合法签名（epaySign 会忽略 sign 字段本身）
const signed = (s: any, q: Record<string, string>) => ({ ...q, sign: s.epaySign(q, 'key456') });

describe('PayService.handleEpayNotify — 回调验签 / 到账 / 幂等', () => {
  test('未配置 key → fail', async () => {
    const { s } = svc({ key: '' });
    expect(await s.handleEpayNotify({ out_trade_no: 'E1', trade_status: 'TRADE_SUCCESS' })).toBe('fail');
  });

  test('签名错误 / 缺签名 → fail，不到账', async () => {
    const { s, state } = svc({ order: { id: 1, gateway: 'epay', amount: '1.00', out_trade_no: 'E1', user_id: 7, points: 100, status: 'pending' } });
    expect(await s.handleEpayNotify({ out_trade_no: 'E1', trade_status: 'TRADE_SUCCESS', sign: 'WRONG' })).toBe('fail');
    expect(await s.handleEpayNotify({ out_trade_no: 'E1', trade_status: 'TRADE_SUCCESS' })).toBe('fail');
    expect(state.awards).toHaveLength(0);
  });

  test('trade_status 非 TRADE_SUCCESS → fail，不到账（即便签名合法）', async () => {
    const { s, state } = svc({ order: { id: 1, gateway: 'epay', amount: '1.00', out_trade_no: 'E1', user_id: 7, points: 100, status: 'pending' } });
    const q = signed(s, { out_trade_no: 'E1', trade_status: 'TRADE_CLOSED' });
    expect(await s.handleEpayNotify(q)).toBe('fail');
    expect(state.awards).toHaveLength(0);
  });

  test('订单不存在 → fail', async () => {
    const { s } = svc({ order: null });
    const q = signed(s, { out_trade_no: 'NOPE', trade_status: 'TRADE_SUCCESS' });
    expect(await s.handleEpayNotify(q)).toBe('fail');
  });

  test('正常回调（pending 订单）→ success，恰好到账一次并标记 paid', async () => {
    const { s, state } = svc({ order: { id: 9, gateway: 'epay', amount: '50.00', out_trade_no: 'E1', user_id: 7, points: 5000, status: 'pending' } });
    const q = signed(s, { pid: 'pid', out_trade_no: 'E1', trade_status: 'TRADE_SUCCESS', trade_no: 'TX1', money: '50.00' });
    expect(await s.handleEpayNotify(q)).toBe('success');
    expect(state.awards).toEqual([
      {
        uid: 7,
        points: 5000,
        reason: '支付充值到账',
        refType: 'payment_order',
        refId: 9,
        manager: expect.anything(),
      },
    ]);
    expect(state.order.status).toBe('paid');
    expect(state.order.trade_no).toBe('TX1');
  });

  test('幂等：已 paid 订单重复回调 → success 但绝不二次到账/不再落库', async () => {
    const { s, state } = svc({ order: { id: 9, gateway: 'epay', amount: '50.00', out_trade_no: 'E1', user_id: 7, points: 5000, status: 'paid' } });
    const q = signed(s, { pid: 'pid', out_trade_no: 'E1', trade_status: 'TRADE_SUCCESS', trade_no: 'TX2', money: '50.00' });
    expect(await s.handleEpayNotify(q)).toBe('success');
    expect(state.awards).toHaveLength(0);       // 关键：不二次发积分
    expect(state.updates).toHaveLength(0);      // 不再改库
  });

  test('金额不符 → fail，不修改订单且不到账', async () => {
    const { s, state } = svc({ order: { id: 9, gateway: 'epay', amount: '50.00', out_trade_no: 'E1', user_id: 7, points: 5000, status: 'pending' } });
    const q = signed(s, { pid: 'pid', out_trade_no: 'E1', trade_status: 'TRADE_SUCCESS', trade_no: 'TX3', money: '0.01' });
    expect(await s.handleEpayNotify(q)).toBe('fail');
    expect(state.updates).toHaveLength(0);
    expect(state.awards).toHaveLength(0);
  });

  test('并发重复回调 → 两次均返回 success，但只认领订单并到账一次', async () => {
    const { s, state } = svc({ order: { id: 9, gateway: 'epay', amount: '50.00', out_trade_no: 'E1', user_id: 7, points: 5000, status: 'pending' } });
    const q = signed(s, { pid: 'pid', out_trade_no: 'E1', trade_status: 'TRADE_SUCCESS', trade_no: 'TX4', money: '50.00' });
    expect(await Promise.all([s.handleEpayNotify(q), s.handleEpayNotify(q)]))
      .toEqual(['success', 'success']);
    expect(state.updates).toHaveLength(1);
    expect(state.awards).toHaveLength(1);
  });
});

import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { PayService } from '../src/modules/pay/pay.service';

// 充值(money-path)是最敏感的经济逻辑。用 mock 仓库/site/helpers 测「真实」createEpay(不改 service 源码):
// 金额边界(1–100000 元, 防越界充值)、1元=100积分换算、分位四舍五入(含浮点安全)、以及未配置网关的门控。
function svc(configOverrides: Record<string, string> = {}) {
  const cfg: Record<string, string> = {
    pay_epay_enabled: '1',
    pay_epay_pid: 'pid123',
    pay_epay_key: 'key456',
    pay_epay_url: 'https://pay.example.com/',
    ...configOverrides,
  };
  const saved: any[] = [];
  const s = new PayService(
    { create: (x: any) => x, save: async (x: any) => { saved.push(x); return x; } } as any, // orders
    null as any, // users (createEpay 不用)
    { getConfig: async (k: string) => (k in cfg ? cfg[k] : null) } as any, // site
    { nowSql: () => '2026-07-02 12:00:00' } as any, // helpers
  );
  return { s, saved };
}
const U = { id: 7 } as any;

describe('PayService.createEpay — 充值 money-path', () => {
  test('金额越界（<1 / >100000 / 0 / 负 / 非数）→ 一律拒绝，不下单', async () => {
    for (const bad of [0, 0.5, 0.99, -5, 100000.01, 100001, 'abc', null]) {
      const { s, saved } = svc();
      await expect(s.createEpay(U, bad, 'alipay', 'https://x')).rejects.toThrow(/1[–\-]100000|金额/);
      expect(saved).toHaveLength(0);
    }
  });

  test('边界含端点：1 元与 100000 元均可下单', async () => {
    const a = await svc().s.createEpay(U, 1, 'alipay', 'https://x');
    expect(a.money).toBe('1.00');
    expect(a.points).toBe(100);
    const b = await svc().s.createEpay(U, 100000, 'alipay', 'https://x');
    expect(b.money).toBe('100000.00');
    expect(b.points).toBe(10000000);
  });

  test('1 元 = 100 积分 换算正确', async () => {
    const r = await svc().s.createEpay(U, 50, 'alipay', 'https://x');
    expect(r.points).toBe(5000);
    expect(r.money).toBe('50.00');
  });

  test('分位四舍五入（浮点安全）：88.88→8888 分, 子分位丢弃 1.004→1.00', async () => {
    const r1 = await svc().s.createEpay(U, 88.88, 'alipay', 'https://x'); // 88.88*100 有浮点误差, round 兜住
    expect(r1.money).toBe('88.88');
    expect(r1.points).toBe(8888);
    const r2 = await svc().s.createEpay(U, 1.004, 'alipay', 'https://x'); // 子分位丢弃
    expect(r2.money).toBe('1.00');
    expect(r2.points).toBe(100);
  });

  test('下单落库：金额/积分/网关/状态 pending 正确写入', async () => {
    const { s, saved } = svc();
    const r = await s.createEpay(U, 20, 'wxpay', 'https://x');
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ user_id: 7, gateway: 'epay', channel: 'wxpay', amount: '20.00', points: 2000, status: 'pending' });
    expect(r.payUrl).toContain('type=wxpay');
  });

  test('网关未配置/未启用 → 拒绝（充值端点受配置门控）', async () => {
    await expect(svc({ pay_epay_enabled: '0' }).s.createEpay(U, 50, 'alipay', 'https://x')).rejects.toThrow(/未配置|未启用/);
    await expect(svc({ pay_epay_pid: '' }).s.createEpay(U, 50, 'alipay', 'https://x')).rejects.toThrow(/未配置|未启用/);
  });
});

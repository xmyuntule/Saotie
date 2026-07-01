import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { HttpException } from '@nestjs/common';
import { RateLimitService } from '../src/common/rate-limit.service';

// 业务频率限制是安全硬化的核心（v4.04 发帖/主题/私信限流、v4.05 防批量注册），此前零测试。
// 用 Map 假缓存 + 假 site_config 仓库实例化，纯逻辑回归：管理员豁免、总开关、阈值≤0 不限、
// 「被挡不计数」、多用户/多 IP 隔离、双窗口兜底、以及最关键的 fail-open（基础设施故障必须放行）。
function makeCache(opts: { throwOnGet?: boolean } = {}) {
  const store = new Map<string, any>();
  return {
    store,
    async get(k: string) { if (opts.throwOnGet) throw new Error('cache down'); return store.get(k); },
    async set(k: string, v: any, _ttl?: number) { store.set(k, v); },
    async del(k: string) { store.delete(k); },
  } as any;
}
function makeCfg(config: Record<string, string>) {
  return {
    async findOne({ where: { key } }: { where: { key: string } }) {
      return key in config ? { key, value: config[key] } : null;
    },
  } as any;
}
const user = (id = 1) => ({ id, role: 'user' } as any);
async function grab(p: Promise<unknown>): Promise<any> {
  try { await p; return null; } catch (e) { return e; }
}
async function expect429(p: Promise<unknown>) {
  const e = await grab(p);
  expect(e).toBeInstanceOf(HttpException);
  expect((e as HttpException).getStatus()).toBe(429);
}

describe('RateLimitService.enforce', () => {
  test('管理员豁免（不抛、不触碰计数）', async () => {
    const cache = makeCache();
    const svc = new RateLimitService(cache, makeCfg({ rate_limit_enabled: '1', rate_post_per_min: '1' }));
    await expect(svc.enforce('post', { id: 9, role: 'admin' } as any)).resolves.toBeUndefined();
    expect(cache.store.size).toBe(0);
  });

  test('总开关关闭 → 放行', async () => {
    const svc = new RateLimitService(makeCache(), makeCfg({ rate_limit_enabled: '0', rate_post_per_min: '1' }));
    await expect(svc.enforce('post', user())).resolves.toBeUndefined();
  });

  test('阈值≤0 的窗口不限（全 0 → 永不挡）', async () => {
    const svc = new RateLimitService(makeCache(), makeCfg({ rate_limit_enabled: '1', rate_post_per_min: '0', rate_post_per_hour: '0' }));
    for (let i = 0; i < 30; i++) await svc.enforce('post', user());
  });

  test('每分钟阈值：前 N 次放行、第 N+1 次 429', async () => {
    const svc = new RateLimitService(makeCache(), makeCfg({ rate_limit_enabled: '1', rate_post_per_min: '2', rate_post_per_hour: '0' }));
    await svc.enforce('post', user());
    await svc.enforce('post', user());
    await expect429(svc.enforce('post', user()));
  });

  test('被挡的请求不计数（两段式：挡了就不 +1）', async () => {
    const cache = makeCache();
    const svc = new RateLimitService(cache, makeCfg({ rate_limit_enabled: '1', rate_post_per_min: '1', rate_post_per_hour: '0' }));
    await svc.enforce('post', user());        // count → 1
    await expect429(svc.enforce('post', user())); // 1>=1 挡，不计数
    const val = [...cache.store.values()][0];
    expect(val).toBe(1); // 仍是 1，未被超限请求推高
  });

  test('不同用户各自独立计数', async () => {
    const svc = new RateLimitService(makeCache(), makeCfg({ rate_limit_enabled: '1', rate_post_per_min: '1', rate_post_per_hour: '0' }));
    await svc.enforce('post', user(1));
    await expect429(svc.enforce('post', user(1)));
    await expect(svc.enforce('post', user(2))).resolves.toBeUndefined();
  });

  test('post 双窗口：更严的小时阈值兜底', async () => {
    const svc = new RateLimitService(makeCache(), makeCfg({ rate_limit_enabled: '1', rate_post_per_min: '10', rate_post_per_hour: '3' }));
    await svc.enforce('post', user());
    await svc.enforce('post', user());
    await svc.enforce('post', user());
    await expect429(svc.enforce('post', user())); // 分钟窗还没满，被小时窗挡下
  });

  test('thread / dm 各用自己的配置键', async () => {
    const svc = new RateLimitService(makeCache(), makeCfg({ rate_limit_enabled: '1', rate_thread_per_min: '1', rate_dm_per_min: '1' }));
    await svc.enforce('thread', user());
    await expect429(svc.enforce('thread', user()));
    await svc.enforce('dm', user());
    await expect429(svc.enforce('dm', user()));
  });

  test('fail-open：缓存故障也放行', async () => {
    const svc = new RateLimitService(makeCache({ throwOnGet: true }), makeCfg({ rate_limit_enabled: '1', rate_post_per_min: '1', rate_post_per_hour: '0' }));
    await expect(svc.enforce('post', user())).resolves.toBeUndefined();
  });
});

describe('RateLimitService.enforceRegistration', () => {
  test('无 IP → 放行', async () => {
    const svc = new RateLimitService(makeCache(), makeCfg({ anti_bulk_reg_enabled: '1', reg_min_interval_sec: '30', reg_ip_max_per_day: '5' }));
    await expect(svc.enforceRegistration(null)).resolves.toBeUndefined();
    await expect(svc.enforceRegistration('')).resolves.toBeUndefined();
  });

  test('总开关关 → 放行', async () => {
    const svc = new RateLimitService(makeCache(), makeCfg({ anti_bulk_reg_enabled: '0', reg_min_interval_sec: '30' }));
    await expect(svc.enforceRegistration('1.2.3.4')).resolves.toBeUndefined();
  });

  test('最小间隔：连续两次注册第二次被挡', async () => {
    const svc = new RateLimitService(makeCache(), makeCfg({ anti_bulk_reg_enabled: '1', reg_min_interval_sec: '30', reg_ip_max_per_day: '0' }));
    await svc.enforceRegistration('1.2.3.4');
    await expect429(svc.enforceRegistration('1.2.3.4'));
  });

  test('每日名额：达上限后被挡', async () => {
    const svc = new RateLimitService(makeCache(), makeCfg({ anti_bulk_reg_enabled: '1', reg_min_interval_sec: '0', reg_ip_max_per_day: '3' }));
    await svc.enforceRegistration('9.9.9.9');
    await svc.enforceRegistration('9.9.9.9');
    await svc.enforceRegistration('9.9.9.9');
    await expect429(svc.enforceRegistration('9.9.9.9'));
  });

  test('不同 IP 独立', async () => {
    const svc = new RateLimitService(makeCache(), makeCfg({ anti_bulk_reg_enabled: '1', reg_min_interval_sec: '30', reg_ip_max_per_day: '0' }));
    await svc.enforceRegistration('1.1.1.1');
    await expect429(svc.enforceRegistration('1.1.1.1'));
    await expect(svc.enforceRegistration('2.2.2.2')).resolves.toBeUndefined();
  });

  test('fail-open：配置查询故障放行', async () => {
    const badCfg = { async findOne() { throw new Error('db down'); } } as any;
    const svc = new RateLimitService(makeCache(), badCfg);
    await expect(svc.enforceRegistration('1.2.3.4')).resolves.toBeUndefined();
  });
});

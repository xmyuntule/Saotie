import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteConfig, User } from '../database/entities';

type Action = 'post' | 'thread' | 'dm';

/**
 * 业务频率限制（防刷屏 / 骚扰 / 灌水）。配置存 site_config，管理员后台可调：
 *   rate_limit_enabled 总开关；rate_post_per_min / rate_post_per_hour / rate_thread_per_min / rate_dm_per_min。
 * 设计要点：
 *  - 管理员豁免；总开关关、或某窗口阈值 ≤ 0 则该项不限。
 *  - 按「用户 + 动作 + 固定时间窗」用 Redis(cache-manager) 计数，超限抛 429（{error} 由全局过滤器规范化）。
 *  - 先查后增（两段式）：被挡的请求不计数，避免把后续窗口越推越满。
 *  - fail-open：读配置或计数出错一律放行，绝不因限流基础设施故障挡正常发帖 / 私信。
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectRepository(SiteConfig) private readonly cfg: Repository<SiteConfig>,
  ) {}

  private async cfgNum(key: string): Promise<number> {
    const row = await this.cfg.findOne({ where: { key } });
    const n = parseInt(row?.value ?? '', 10);
    return Number.isFinite(n) ? n : 0;
  }

  /** 超限抛 429；放行则静默返回。读配置/计数异常一律放行（fail-open）。 */
  async enforce(action: Action, user: User | null | undefined): Promise<void> {
    let blocked = false;
    try {
      if (!user || user.role === 'admin') return; // 管理员不受限
      const enabled =
        (await this.cfg.findOne({ where: { key: 'rate_limit_enabled' } }))
          ?.value === '1';
      if (!enabled) return;

      const windows: { tag: string; sec: number; limit: number }[] = [];
      if (action === 'post') {
        windows.push({ tag: 'p1', sec: 60, limit: await this.cfgNum('rate_post_per_min') });
        windows.push({ tag: 'p60', sec: 3600, limit: await this.cfgNum('rate_post_per_hour') });
      } else if (action === 'thread') {
        windows.push({ tag: 't1', sec: 60, limit: await this.cfgNum('rate_thread_per_min') });
      } else {
        windows.push({ tag: 'd1', sec: 60, limit: await this.cfgNum('rate_dm_per_min') });
      }

      // 段一：只读计数，判断是否超限（被挡则不写计数）
      const toBump: { key: string; next: number; ttlMs: number }[] = [];
      for (const w of windows) {
        if (w.limit <= 0) continue; // ≤0 视为该窗口不限
        const bucket = Math.floor(Date.now() / 1000 / w.sec);
        const key = `rl:${action}:${w.tag}:${user.id}:${bucket}`;
        const count = Number(await this.cache.get(key)) || 0;
        if (count >= w.limit) {
          blocked = true;
          break;
        }
        toBump.push({ key, next: count + 1, ttlMs: w.sec * 1000 });
      }
      // 段二：放行才记一次（ttl 毫秒，cache-manager v5）
      if (!blocked) {
        for (const b of toBump) await this.cache.set(b.key, b.next, b.ttlMs);
      }
    } catch (e: any) {
      this.logger.warn(`rate-limit skipped (fail-open): ${e?.message || e}`);
      return;
    }
    if (blocked)
      throw new HttpException(
        '操作太频繁了，请稍后再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }
}

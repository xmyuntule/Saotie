import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SiteConfig } from '../database/entities';
import { setSensitiveConfig } from './sensitive';

/**
 * 让 checkSensitive 可被站长后台配置（site_config: sensitive_enabled + sensitive_words）。
 * checkSensitive 是同步函数、被 14+ service 直接调用，无法逐处改 async；因此这里把 DB
 * 配置定期(20s)+启动时+admin 写入后刷进 sensitive.ts 的进程内缓存。Mirrors Express getConfig 即时读。
 */
@Injectable()
export class SensitiveService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(SiteConfig)
    private readonly repo: Repository<SiteConfig>,
  ) {}

  /** 从 site_config 读取并刷新进程内缓存。 */
  async refresh(): Promise<void> {
    const rows = await this.repo.find({
      where: { key: In(['sensitive_enabled', 'sensitive_words']) },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    setSensitiveConfig(
      map.get('sensitive_enabled') ?? '1',
      map.get('sensitive_words') ?? '',
    );
  }

  async onModuleInit(): Promise<void> {
    await this.refresh().catch(() => undefined);
    // 周期刷新作兜底（admin 写入会主动 refresh，但其它进程/直改 DB 也能在 20s 内生效）
    this.timer = setInterval(() => {
      this.refresh().catch(() => undefined);
    }, 20000);
    if (this.timer.unref) this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}

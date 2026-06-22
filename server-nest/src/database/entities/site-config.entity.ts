import { Column, Entity, PrimaryColumn } from 'typeorm';

/** site_config — 键值站点配置（品牌 / 自定义 CSS / 安全开关 / 模块开关）。Mirrors db.js site_config. */
@Entity('site_config')
export class SiteConfig {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'text', default: '' })
  value: string;
}

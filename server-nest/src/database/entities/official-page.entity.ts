import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** official_pages — www.saotie.com 可编辑的官网页面。 */
@Entity('official_pages')
@Index('idx_official_pages_status_sort', ['status', 'sort'])
export class OfficialPage {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  slug: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ name: 'seo_title', type: 'varchar', length: 160, default: '' })
  seo_title: string;

  @Column({ name: 'seo_keywords', type: 'varchar', length: 255, default: '' })
  seo_keywords: string;

  @Column({ name: 'seo_description', type: 'varchar', length: 255, default: '' })
  seo_description: string;

  @Column({ type: 'text', nullable: true })
  cover: string | null;

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ type: 'smallint', default: 1 })
  status: number;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32 })
  created_at: string;

  @Column({ name: 'updated_at', type: 'varchar', length: 32 })
  updated_at: string;
}

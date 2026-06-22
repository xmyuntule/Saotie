import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** site_notices — 全站运营公告 banner。Mirrors db.js site_notices. */
@Entity('site_notices')
export class SiteNotice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 128 })
  title: string;

  @Column({ type: 'text', default: '' })
  body: string;

  @Column({ type: 'varchar', length: 16, default: 'info' })
  level: string;

  @Column({ type: 'text', default: '' })
  link: string;

  @Column({ name: 'link_label', type: 'varchar', length: 64, default: '' })
  link_label: string;

  @Column({ type: 'smallint', default: 1 })
  active: number;

  @Column({ type: 'smallint', default: 0 })
  pinned: number;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  created_by: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;

  @Column({ name: 'updated_at', type: 'varchar', length: 32, nullable: true })
  updated_at: string;
}

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** flash — 资讯快报 / 公告 (portal-style news feed). Mirrors db.js. */
@Entity('flash')
export class Flash {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 128 })
  title: string;

  @Column({ type: 'text', default: '' })
  summary: string;

  @Column({ type: 'varchar', length: 32, default: '动态' })
  category: string;

  @Column({ type: 'text', default: '' })
  url: string;

  @Column({ type: 'smallint', default: 0 })
  pinned: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

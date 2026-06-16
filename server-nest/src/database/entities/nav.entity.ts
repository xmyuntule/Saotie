import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** nav_categories — 网址导航 categories. Mirrors db.js. */
@Entity('nav_categories')
export class NavCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  name: string;

  @Column({ type: 'varchar', length: 32, default: 'compass' })
  icon: string;

  @Column({ type: 'int', default: 0 })
  position: number;
}

/** nav_links — 网址导航 links. Mirrors db.js. */
@Entity('nav_links')
@Index('idx_nav_links_cat', ['category_id'])
export class NavLink {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_id', type: 'int' })
  category_id: number;

  @Column({ type: 'varchar', length: 64 })
  title: string;

  @Column({ type: 'varchar', length: 300 })
  url: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'varchar', length: 32, default: '' })
  color: string;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

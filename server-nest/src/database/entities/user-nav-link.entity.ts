import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** user_nav_links — 用户个人网址收藏夹（每个用户自己的常用网址，独立于管理员维护的「站点推荐」目录）。 */
@Entity('user_nav_links')
@Index('idx_user_nav', ['user_id', 'id'])
export class UserNavLink {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 40 })
  title: string;

  @Column({ type: 'varchar', length: 300 })
  url: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  description: string;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

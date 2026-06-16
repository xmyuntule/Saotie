import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

/** circles — interest communities. Mirrors db.js. */
@Entity('circles')
export class Circle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  slug: string | null;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'varchar', length: 32, default: '兴趣' })
  category: string;

  @Column({ type: 'varchar', length: 32, default: '' })
  color: string;

  @Column({ type: 'varchar', length: 32, default: 'circle' })
  icon: string;

  @Column({ type: 'text', default: '' })
  cover: string;

  @Column({ name: 'owner_id', type: 'int', nullable: true })
  owner_id: number | null;

  @Column({ name: 'member_count', type: 'int', default: 0 })
  member_count: number;

  @Column({ name: 'post_count', type: 'int', default: 0 })
  post_count: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

/** circle_members — composite PK (circle_id, user_id). */
@Entity('circle_members')
@Index('idx_circle_members_user', ['user_id'])
export class CircleMember {
  @PrimaryColumn({ name: 'circle_id', type: 'int' })
  circle_id: number;

  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 16, default: 'member' })
  role: string;

  @Column({ name: 'joined_at', type: 'varchar', length: 32, nullable: true })
  joined_at: string;
}

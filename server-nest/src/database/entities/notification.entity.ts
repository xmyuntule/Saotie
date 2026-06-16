import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** notifications — 通知. Mirrors schema.sql. */
@Entity('notifications')
@Index('idx_notifications_user', ['user_id'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actor_id: number | null;

  @Column({ type: 'varchar', length: 32 })
  type: string;

  @Column({ name: 'target_type', type: 'varchar', length: 16, nullable: true })
  target_type: string | null;

  @Column({ name: 'target_id', type: 'int', nullable: true })
  target_id: number | null;

  @Column({ type: 'text', default: '' })
  preview: string;

  @Column({ type: 'smallint', default: 0 })
  read: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

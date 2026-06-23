import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** view_history — 浏览足迹(每用户每内容一行, 复合主键)。Mirrors db.js view_history. */
@Entity('view_history')
@Index('idx_view_history_user', ['user_id', 'viewed_at'])
export class ViewHistory {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;

  @PrimaryColumn({ name: 'target_type', type: 'varchar', length: 16 })
  target_type: string;

  @PrimaryColumn({ name: 'target_id', type: 'int' })
  target_id: number;

  @Column({ name: 'viewed_at', type: 'varchar', length: 32, nullable: true })
  viewed_at: string;
}

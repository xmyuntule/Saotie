import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * likes — polymorphic likes. target_type ∈ post | comment | thread.
 * Composite PK (user_id, target_type, target_id).
 */
@Entity('likes')
@Index('idx_likes_target', ['target_type', 'target_id'])
@Index('idx_likes_user', ['user_id'])
export class Like {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;

  @PrimaryColumn({ name: 'target_type', type: 'varchar', length: 16 })
  target_type: string;

  @PrimaryColumn({ name: 'target_id', type: 'int' })
  target_id: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

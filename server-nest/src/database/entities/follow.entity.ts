import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * follows — directed follow graph. Composite PK (follower_id, following_id).
 */
@Entity('follows')
@Index('idx_follows_following', ['following_id'])
@Index('idx_follows_follower', ['follower_id'])
export class Follow {
  @PrimaryColumn({ name: 'follower_id', type: 'int' })
  follower_id: number;

  @PrimaryColumn({ name: 'following_id', type: 'int' })
  following_id: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

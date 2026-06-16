import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** bookmarks — 收藏. Composite PK (user_id, post_id). */
@Entity('bookmarks')
@Index('idx_bookmarks_user', ['user_id'])
export class Bookmark {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;

  @PrimaryColumn({ name: 'post_id', type: 'int' })
  post_id: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

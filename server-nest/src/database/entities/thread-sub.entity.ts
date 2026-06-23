import { Column, Entity, PrimaryColumn } from 'typeorm';

/** thread_subs — 帖子订阅(每用户每帖一行, 复合主键)。Mirrors db.js thread_subs.
 * 订阅后帖子有新回复收到通知；楼主发帖、回复者回复时自动订阅。 */
@Entity('thread_subs')
export class ThreadSub {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;

  @PrimaryColumn({ name: 'thread_id', type: 'int' })
  thread_id: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

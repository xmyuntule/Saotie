import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** circle_messages — 圈子聊天室消息（仅圈子成员可见/可发）。 */
@Entity('circle_messages')
@Index('idx_circle_msg', ['circle_id', 'id'])
export class CircleMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'circle_id', type: 'int' })
  circle_id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 1000 })
  content: string;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

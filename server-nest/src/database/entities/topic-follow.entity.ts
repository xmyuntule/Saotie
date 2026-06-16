import { Column, Entity, PrimaryColumn } from 'typeorm';

/** topic_follows — composite PK (user_id, topic_id). Mirrors db.js. */
@Entity('topic_follows')
export class TopicFollow {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;

  @PrimaryColumn({ name: 'topic_id', type: 'int' })
  topic_id: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

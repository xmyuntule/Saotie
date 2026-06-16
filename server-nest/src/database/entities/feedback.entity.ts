import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** feedback — 问题反馈 (bug/feature feedback). Mirrors db.js. */
@Entity('feedback')
export class Feedback {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  user_id: number | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: string;

  @Column({ type: 'text', default: '' })
  reply: string;

  @Column({ name: 'replied_at', type: 'varchar', length: 32, nullable: true })
  replied_at: string | null;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

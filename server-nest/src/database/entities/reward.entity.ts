import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** rewards — 打赏 records. Mirrors schema.sql. */
@Entity('rewards')
export class Reward {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'from_id', type: 'int' })
  from_id: number;

  @Column({ name: 'to_id', type: 'int' })
  to_id: number;

  @Column({ name: 'post_id', type: 'int', nullable: true })
  post_id: number | null;

  @Column({ type: 'int' })
  amount: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

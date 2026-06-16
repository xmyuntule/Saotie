import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** reports — 举报. Mirrors schema.sql. */
@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reporter_id', type: 'int' })
  reporter_id: number;

  @Column({ name: 'target_type', type: 'varchar', length: 16 })
  target_type: string;

  @Column({ name: 'target_id', type: 'int' })
  target_id: number;

  @Column({ type: 'text', default: '' })
  reason: string;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: string;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

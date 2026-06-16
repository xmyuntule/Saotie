import { Column, Entity, PrimaryColumn } from 'typeorm';

/** blocks — 拉黑. Composite PK (blocker_id, blocked_id). */
@Entity('blocks')
export class Block {
  @PrimaryColumn({ name: 'blocker_id', type: 'int' })
  blocker_id: number;

  @PrimaryColumn({ name: 'blocked_id', type: 'int' })
  blocked_id: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

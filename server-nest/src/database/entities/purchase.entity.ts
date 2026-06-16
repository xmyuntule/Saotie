import { Column, Entity, PrimaryColumn } from 'typeorm';

/** purchases — paid-post unlocks. Composite PK (user_id, post_id). */
@Entity('purchases')
export class Purchase {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;

  @PrimaryColumn({ name: 'post_id', type: 'int' })
  post_id: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

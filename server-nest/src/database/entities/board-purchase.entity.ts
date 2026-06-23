import { Column, Entity, PrimaryColumn } from 'typeorm';

/** board_purchases — 付费板块解锁记录(每用户每板一行, 复合主键)。Mirrors db.js board_purchases.
 * 一次解锁，永久可看。 */
@Entity('board_purchases')
export class BoardPurchase {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;

  @PrimaryColumn({ name: 'board_id', type: 'int' })
  board_id: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

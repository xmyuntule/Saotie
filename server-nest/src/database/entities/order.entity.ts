import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * orders — mall purchases. `used` (db.js migration) tracks consumable items
 * such as 改名卡 (rename) and 全站置顶卡 (pin).
 */
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ name: 'product_id', type: 'int' })
  product_id: number;

  @Column({ type: 'int' })
  price: number;

  @Column({ type: 'smallint', default: 0 })
  used: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** products — 积分商城 catalog. Mirrors schema.sql. */
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'varchar', length: 32, default: '🎁' })
  icon: string;

  @Column({ type: 'varchar', length: 32, default: 'item' })
  category: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  payload: string;

  @Column({ type: 'int' })
  price: number;

  @Column({ type: 'int', default: -1 })
  stock: number;

  @Column({ type: 'int', default: 0 })
  sold: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

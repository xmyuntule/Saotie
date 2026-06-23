import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** collections — 内容专题/合集（用户策展一组动态/文章）。 */
@Entity('collections')
@Index('idx_collection_user', ['user_id'])
export class Collection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 80 })
  title: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  cover: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  description: string;

  // 收录条目数（去规范化，便于列表展示）
  @Column({ name: 'item_count', type: 'int', default: 0 })
  item_count: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;

  @Column({ name: 'updated_at', type: 'varchar', length: 32, nullable: true })
  updated_at: string;
}

/** collection_items — 专题收录的条目（post/article），每专题每条目唯一。 */
@Entity('collection_items')
@Index('idx_collection_item_coll', ['collection_id'])
@Unique('uq_collection_item', ['collection_id', 'target_type', 'target_id'])
export class CollectionItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'collection_id', type: 'int' })
  collection_id: number;

  @Column({ name: 'target_type', type: 'varchar', length: 16 })
  target_type: string;

  @Column({ name: 'target_id', type: 'int' })
  target_id: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

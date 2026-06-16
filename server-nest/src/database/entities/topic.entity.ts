import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** topics — hashtags / 话题. Mirrors schema.sql. */
@Entity('topics')
export class Topic {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'text', nullable: true })
  cover: string | null;

  @Column({ name: 'post_count', type: 'int', default: 0 })
  post_count: number;

  @Column({ type: 'int', default: 0 })
  hot: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

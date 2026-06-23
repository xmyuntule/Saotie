import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** articles — 专栏文章。Mirrors db.js articles. */
@Entity('articles')
@Index('idx_articles_cat', ['category', 'created_at'])
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', default: '' })
  summary: string;

  @Column({ type: 'text', default: '' })
  cover: string;

  @Column({ type: 'mediumtext' })
  content: string;

  @Column({ type: 'varchar', length: 32, default: '综合' })
  category: string;

  @Column({ type: 'smallint', default: 0 })
  featured: number;

  @Column({ type: 'int', default: 0 })
  views: number;

  @Column({ name: 'like_count', type: 'int', default: 0 })
  like_count: number;

  @Column({ name: 'comment_count', type: 'int', default: 0 })
  comment_count: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

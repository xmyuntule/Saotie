import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

/** boards — 论坛板块. Mirrors schema.sql. */
@Entity('boards')
export class Board {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parent_id: number | null;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  slug: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'text', nullable: true })
  cover: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  icon: string | null;

  @Column({ type: 'text', default: '' })
  announcement: string;

  @Column({ name: 'is_paid', type: 'smallint', default: 0 })
  is_paid: number;

  @Column({ type: 'int', default: 0 })
  price: number;

  @Column({ name: 'thread_count', type: 'int', default: 0 })
  thread_count: number;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

/** board_follows — 关注板块. Composite PK. Mirrors schema.sql. */
@Entity('board_follows')
export class BoardFollow {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;

  @PrimaryColumn({ name: 'board_id', type: 'int' })
  board_id: number;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

/** moderators — 版主. Composite PK. Mirrors schema.sql. */
@Entity('moderators')
export class Moderator {
  @PrimaryColumn({ name: 'board_id', type: 'int' })
  board_id: number;

  @PrimaryColumn({ name: 'user_id', type: 'int' })
  user_id: number;
}

/** threads — 论坛帖子. Mirrors schema.sql (+ db.js: edited). */
@Entity('threads')
@Index('idx_threads_board', ['board_id'])
export class Thread {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'board_id', type: 'int' })
  board_id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', default: '[]' })
  media: string;

  @Column({ type: 'smallint', default: 0 })
  pinned: number;

  @Column({ type: 'smallint', default: 0 })
  elite: number;

  @Column({ type: 'smallint', default: 0 })
  locked: number;

  @Column({ type: 'int', default: 0 })
  views: number;

  @Column({ name: 'like_count', type: 'int', default: 0 })
  like_count: number;

  @Column({ name: 'reply_count', type: 'int', default: 0 })
  reply_count: number;

  @Column({ type: 'smallint', default: 0 })
  edited: number;

  @Column({ name: 'last_reply_at', type: 'varchar', length: 32, nullable: true })
  last_reply_at: string;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string;
}

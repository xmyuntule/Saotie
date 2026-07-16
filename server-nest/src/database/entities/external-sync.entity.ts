import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** RSS/Atom sources configured by admins for off-site content sync. */
@Entity('external_sync_sources')
@Index('idx_external_sync_sources_user', ['user_id'])
@Index('idx_external_sync_sources_board', ['board_id'])
@Index('idx_external_sync_sources_owner', ['owner_configured', 'user_id'])
export class ExternalSyncSource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ name: 'board_id', type: 'int' })
  board_id: number;

  @Column({ name: 'target_type', type: 'varchar', length: 16, default: 'thread' })
  target_type: string;

  @Column({ name: 'owner_configured', type: 'smallint', default: 0 })
  owner_configured: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'rss_url', type: 'text' })
  rss_url: string;

  @Column({ type: 'text' })
  template: string;

  @Column({ type: 'smallint', default: 1 })
  enabled: number;

  @Column({ name: 'auto_publish', type: 'smallint', default: 1 })
  auto_publish: number;

  @Column({ name: 'max_images', type: 'int', default: 3 })
  max_images: number;

  @Column({ name: 'fetch_interval_min', type: 'int', default: 60 })
  fetch_interval_min: number;

  @Column({ name: 'last_fetched_at', type: 'varchar', length: 32, nullable: true })
  last_fetched_at: string | null;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string | null;

  @Column({ name: 'updated_at', type: 'varchar', length: 32, nullable: true })
  updated_at: string | null;
}

/** Import records prevent duplicate posts and preserve sync errors. */
@Entity('external_sync_imports')
@Index('uq_external_sync_imports_source_hash', ['source_id', 'source_hash'], {
  unique: true,
})
@Index('idx_external_sync_imports_source', ['source_id'])
export class ExternalSyncImport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'source_id', type: 'int' })
  source_id: number;

  @Column({ name: 'source_url', type: 'text' })
  source_url: string;

  @Column({ name: 'source_guid', type: 'varchar', length: 255 })
  source_guid: string;

  @Column({ name: 'source_hash', type: 'varchar', length: 64 })
  source_hash: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 24, default: 'published' })
  status: string;

  @Column({ name: 'thread_id', type: 'int', nullable: true })
  thread_id: number | null;

  @Column({ name: 'post_id', type: 'int', nullable: true })
  post_id: number | null;

  @Column({ type: 'text', default: '' })
  error: string;

  @Column({ type: 'smallint', default: 0 })
  hidden: number;

  @Column({ name: 'cleared_at', type: 'varchar', length: 32, nullable: true })
  cleared_at: string | null;

  @Column({ name: 'created_at', type: 'varchar', length: 32, nullable: true })
  created_at: string | null;
}

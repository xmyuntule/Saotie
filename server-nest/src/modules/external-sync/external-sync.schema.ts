import { DataSource } from 'typeorm';

export async function ensureExternalSyncSchema(dataSource: DataSource) {
  const type = String(dataSource.options.type || '');
  if (type === 'postgres' || type === 'postgresql') {
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS external_sync_sources (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        board_id INT NOT NULL,
        target_type VARCHAR(16) NOT NULL DEFAULT 'thread',
        owner_configured SMALLINT NOT NULL DEFAULT 0,
        name VARCHAR(120) NOT NULL,
        rss_url TEXT NOT NULL,
        template TEXT NOT NULL,
        enabled SMALLINT NOT NULL DEFAULT 1,
        auto_publish SMALLINT NOT NULL DEFAULT 1,
        max_images INT NOT NULL DEFAULT 3,
        fetch_interval_min INT NOT NULL DEFAULT 1440,
        verification_token VARCHAR(96) NULL,
        verified_at VARCHAR(32) NULL,
        verification_checked_at VARCHAR(32) NULL,
        last_fetched_at VARCHAR(32) NULL,
        created_at VARCHAR(32) NULL,
        updated_at VARCHAR(32) NULL
      )
    `);
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS external_sync_imports (
        id SERIAL PRIMARY KEY,
        source_id INT NOT NULL,
        source_url TEXT NOT NULL,
        source_guid VARCHAR(255) NOT NULL,
        source_hash VARCHAR(64) NOT NULL,
        title VARCHAR(200) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'published',
        thread_id INT NULL,
        post_id INT NULL,
        error TEXT NOT NULL DEFAULT '',
        hidden SMALLINT NOT NULL DEFAULT 0,
        cleared_at VARCHAR(32) NULL,
        created_at VARCHAR(32) NULL
      )
    `);
    await dataSource.query(
      'CREATE INDEX IF NOT EXISTS idx_external_sync_sources_user ON external_sync_sources(user_id)',
    );
    await dataSource.query(
      'CREATE INDEX IF NOT EXISTS idx_external_sync_sources_board ON external_sync_sources(board_id)',
    );
    await dataSource.query(
      'CREATE INDEX IF NOT EXISTS idx_external_sync_imports_source ON external_sync_imports(source_id)',
    );
    await dataSource.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_external_sync_imports_source_hash ON external_sync_imports(source_id, source_hash)',
    );
    await ensureExternalSyncColumns(dataSource);
    return;
  }

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS external_sync_sources (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      board_id INT NOT NULL,
      target_type VARCHAR(16) NOT NULL DEFAULT 'thread',
      owner_configured SMALLINT NOT NULL DEFAULT 0,
      name VARCHAR(120) NOT NULL,
      rss_url TEXT NOT NULL,
      template TEXT NOT NULL,
      enabled SMALLINT NOT NULL DEFAULT 1,
      auto_publish SMALLINT NOT NULL DEFAULT 1,
      max_images INT NOT NULL DEFAULT 3,
      fetch_interval_min INT NOT NULL DEFAULT 1440,
      verification_token VARCHAR(96) NULL,
      verified_at VARCHAR(32) NULL,
      verification_checked_at VARCHAR(32) NULL,
      last_fetched_at VARCHAR(32) NULL,
      created_at VARCHAR(32) NULL,
      updated_at VARCHAR(32) NULL,
      INDEX idx_external_sync_sources_user (user_id),
      INDEX idx_external_sync_sources_board (board_id)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS external_sync_imports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source_id INT NOT NULL,
      source_url TEXT NOT NULL,
      source_guid VARCHAR(255) NOT NULL,
      source_hash VARCHAR(64) NOT NULL,
      title VARCHAR(200) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'published',
      thread_id INT NULL,
      post_id INT NULL,
      error TEXT NOT NULL,
      hidden SMALLINT NOT NULL DEFAULT 0,
      cleared_at VARCHAR(32) NULL,
      created_at VARCHAR(32) NULL,
      UNIQUE KEY uq_external_sync_imports_source_hash (source_id, source_hash),
      INDEX idx_external_sync_imports_source (source_id)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureExternalSyncColumns(dataSource);
}

async function ensureExternalSyncColumns(dataSource: DataSource) {
  await dataSource
    .query('ALTER TABLE external_sync_imports ADD COLUMN IF NOT EXISTS hidden SMALLINT NOT NULL DEFAULT 0')
    .catch(() => undefined);
  await dataSource
    .query('ALTER TABLE external_sync_imports ADD COLUMN IF NOT EXISTS cleared_at VARCHAR(32) NULL')
    .catch(() => undefined);
  await dataSource
    .query("ALTER TABLE external_sync_sources ADD COLUMN IF NOT EXISTS target_type VARCHAR(16) NOT NULL DEFAULT 'thread'")
    .catch(() => undefined);
  await dataSource
    .query('ALTER TABLE external_sync_sources ADD COLUMN IF NOT EXISTS owner_configured SMALLINT NOT NULL DEFAULT 0')
    .catch(() => undefined);
  await dataSource
    .query('ALTER TABLE external_sync_imports ADD COLUMN IF NOT EXISTS post_id INT NULL')
    .catch(() => undefined);
  await dataSource
    .query('ALTER TABLE external_sync_sources ADD COLUMN IF NOT EXISTS verification_token VARCHAR(96) NULL')
    .catch(() => undefined);
  await dataSource
    .query('ALTER TABLE external_sync_sources ADD COLUMN IF NOT EXISTS verified_at VARCHAR(32) NULL')
    .catch(() => undefined);
  await dataSource
    .query('ALTER TABLE external_sync_sources ADD COLUMN IF NOT EXISTS verification_checked_at VARCHAR(32) NULL')
    .catch(() => undefined);
  await dataSource
    .query('ALTER TABLE external_sync_sources ALTER COLUMN fetch_interval_min SET DEFAULT 1440')
    .catch(() => undefined);
  await dataSource
    .query('ALTER TABLE external_sync_sources MODIFY fetch_interval_min INT NOT NULL DEFAULT 1440')
    .catch(() => undefined);
}

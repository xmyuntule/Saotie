# SaotieSNS operations runbook

This document records the basic production operations used by the Docker deployment.

## Backup

Run a manual backup from the project root:

```bash
npm run backup
```

Install the daily backup schedule:

```bash
npm run backup:cron
```

The installer uses cron when available, otherwise it creates a systemd timer. Default schedule: daily around `03:20` Asia/Shanghai.

The backup script stores:

- MariaDB dump: `db.sql.gz`
- uploaded files: `uploads.tgz`
- metadata and checksums

Verify a backup:

```bash
cd /opt/hahasns-backups/latest
sha256sum -c SHA256SUMS
```

Defaults:

- backup directory: `/opt/hahasns-backups`
- retention: `14` days

Override with `.env`:

```bash
BACKUP_DIR=/opt/hahasns-backups
BACKUP_RETENTION_DAYS=14
```

## Deploy Check

Run:

```bash
npm run deploy:check
```

The check validates required environment variables, disk space, and Docker Compose syntax. Strict mode is used by the production deploy script:

```bash
REQUIRE_ENV=1 REQUIRE_DOCKER=1 node scripts/check-deploy.mjs
```

## Production Deploy

Run:

```bash
npm run deploy:prod
```

The deploy script runs checks, tests, local builds, backup, Docker image build, container restart, and health check. If the new app fails health check, it retags the previous image back to `hahasns:latest` and restarts the app container.

Useful flags:

```bash
SKIP_LOCAL_CHECKS=1 npm run deploy:prod
RUN_BACKUP=0 npm run deploy:prod
CLEAN_DOCKER_AFTER_DEPLOY=1 npm run deploy:prod
```

## Logs

Docker JSON logs are capped by Compose:

```bash
DOCKER_LOG_MAX_SIZE=10m
DOCKER_LOG_MAX_FILE=3
```

This avoids unbounded growth under `/var/lib/docker/containers`.

## Restore

Restore is intentionally documented instead of automated because it overwrites production data. Confirm the target backup directory first:

```bash
BACKUP=/opt/hahasns-backups/hahasns-YYYYMMDD-HHMMSS
cd /opt/hahasns
```

Verify checksums:

```bash
cd "$BACKUP"
sha256sum -c SHA256SUMS
```

Restore the database:

```bash
cd /opt/hahasns
set -a
. ./.env
set +a
gunzip -c "$BACKUP/db.sql.gz" | sudo docker compose exec -T -e MYSQL_PWD="${DB_ROOT_PASSWORD:-$DB_PASSWORD}" mariadb mariadb -uroot hahasns
```

Restore uploads:

```bash
sudo docker compose exec -T app sh -lc 'cd /app/uploads && tar -xzf -' < "$BACKUP/uploads.tgz"
```

Restart and verify:

```bash
sudo docker compose up -d
curl -fsS http://127.0.0.1:${APP_PORT:-4000}/api/health
```

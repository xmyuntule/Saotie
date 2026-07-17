#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
SUDO="${SUDO:-sudo}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[ -f "$ENV_FILE" ] || fail "missing env file: $ENV_FILE"

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

DB_NAME="${DB_NAME:-hahasns}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-${DB_PASSWORD:-}}"
BACKUP_DIR="${BACKUP_DIR:-/opt/hahasns-backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

[ -n "${DB_ROOT_PASSWORD:-}" ] || fail "DB_PASSWORD or DB_ROOT_PASSWORD is required"
[ -n "$BACKUP_DIR" ] || fail "BACKUP_DIR is empty"
[ "$BACKUP_DIR" != "/" ] || fail "refusing to use / as BACKUP_DIR"
[[ "$BACKUP_RETENTION_DAYS" =~ ^[0-9]+$ ]] || fail "BACKUP_RETENTION_DAYS must be a number"

command -v gzip >/dev/null 2>&1 || fail "gzip is required"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"

TS="$(date -u +%Y%m%d-%H%M%S)"
DEST="$BACKUP_DIR/hahasns-$TS"

$SUDO mkdir -p "$BACKUP_DIR"
$SUDO chown "$(id -u):$(id -g)" "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
mkdir -p "$DEST"
chmod 700 "$DEST"

echo "Backing up database to $DEST/db.sql.gz"
$SUDO docker compose exec -T -e MYSQL_PWD="$DB_ROOT_PASSWORD" mariadb \
  mariadb-dump -uroot --single-transaction --quick --routines --triggers "$DB_NAME" \
  | gzip -9 > "$DEST/db.sql.gz"

echo "Backing up uploads to $DEST/uploads.tgz"
$SUDO docker compose exec -T app sh -lc 'cd /app/uploads && tar -czf - .' > "$DEST/uploads.tgz"

{
  echo "created_at=$(date -Is)"
  echo "project=$ROOT_DIR"
  echo "git_commit=$(git rev-parse HEAD 2>/dev/null || true)"
  echo "db_name=$DB_NAME"
  echo
  $SUDO docker compose ps
} > "$DEST/metadata.txt"

(
  cd "$DEST"
  sha256sum db.sql.gz uploads.tgz metadata.txt > SHA256SUMS
)

ln -sfn "$DEST" "$BACKUP_DIR/latest"

if [ "$BACKUP_RETENTION_DAYS" -gt 0 ]; then
  find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'hahasns-*' -mtime +"$BACKUP_RETENTION_DAYS" -print -exec rm -rf -- {} +
fi

echo "Backup complete:"
du -sh "$DEST"

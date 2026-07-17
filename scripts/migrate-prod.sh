#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ACTION="${1:-show}"
SUDO="${SUDO:-sudo}"

case "$ACTION" in
  show|run|revert) ;;
  *)
    echo "Usage: $0 {show|run|revert}" >&2
    exit 2
    ;;
esac

node scripts/check-migrations.mjs
REQUIRE_ENV=1 REQUIRE_DOCKER=1 node scripts/check-deploy.mjs

$SUDO docker compose exec -T mariadb healthcheck.sh --connect --innodb_initialized >/dev/null

if [ "$ACTION" != "show" ]; then
  if [ "${CONFIRM_MIGRATION:-0}" != "1" ]; then
    echo "Refusing to run migration:$ACTION without CONFIRM_MIGRATION=1" >&2
    exit 1
  fi

  if [ "${BUILD_IMAGE:-0}" = "1" ]; then
    $SUDO docker compose build app
  elif [ "${FROM_DEPLOY:-0}" != "1" ]; then
    echo "WARN: migration:$ACTION uses the current hahasns:latest image. Set BUILD_IMAGE=1 to rebuild it first." >&2
  fi

  if [ "${RUN_BACKUP:-1}" != "0" ]; then
    bash scripts/backup.sh
  fi
fi

CMD="cd /app/server-nest && node ./node_modules/typeorm/cli.js -d dist/database/data-source.js migration:$ACTION"

echo "Running TypeORM migration:$ACTION inside a one-off app container"
$SUDO docker compose run --rm --no-deps app sh -lc "$CMD"

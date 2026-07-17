#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SUDO="${SUDO:-sudo}"
TS="$(date -u +%Y%m%d-%H%M%S)"
ROLLBACK_IMAGE="hahasns:rollback-$TS"
HAD_PREVIOUS_IMAGE=0

echo "Running strict deploy checks"
REQUIRE_ENV=1 REQUIRE_DOCKER=1 node scripts/check-deploy.mjs
node scripts/check-migrations.mjs

if [ "${SKIP_LOCAL_CHECKS:-0}" != "1" ]; then
  npm run check
  npm run build
fi

if [ "${RUN_BACKUP:-1}" != "0" ]; then
  bash scripts/backup.sh
fi

if $SUDO docker image inspect hahasns:latest >/dev/null 2>&1; then
  HAD_PREVIOUS_IMAGE=1
  $SUDO docker tag hahasns:latest "$ROLLBACK_IMAGE"
  echo "Rollback image saved as $ROLLBACK_IMAGE"
fi

echo "Building app image"
$SUDO docker compose build app

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  if [ "${STOP_APP_FOR_MIGRATIONS:-0}" = "1" ]; then
    $SUDO docker compose stop app
  fi
  FROM_DEPLOY=1 RUN_BACKUP=0 bash scripts/migrate-prod.sh run
fi

echo "Starting app container"
$SUDO docker compose up -d app

echo "Waiting for health check"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:${APP_PORT:-4000}/api/health >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 3
done

if [ "$ok" != "1" ]; then
  echo "Deploy health check failed" >&2
  if [ "$HAD_PREVIOUS_IMAGE" = "1" ]; then
    echo "Rolling back to $ROLLBACK_IMAGE" >&2
    $SUDO docker tag "$ROLLBACK_IMAGE" hahasns:latest
    $SUDO docker compose up -d app
  fi
  exit 1
fi

if [ "${CLEAN_DOCKER_AFTER_DEPLOY:-0}" = "1" ]; then
  $SUDO docker builder prune -af
  $SUDO docker image prune -af --filter "until=24h"
fi

echo "Deploy complete"

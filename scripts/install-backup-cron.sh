#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEDULE="${BACKUP_CRON_SCHEDULE:-20 3 * * *}"
LOG_FILE="${BACKUP_CRON_LOG:-/opt/hahasns-backups/backup.log}"
MARKER="# hahasns automated backup"
LINE="$SCHEDULE cd $ROOT_DIR && /usr/bin/env bash scripts/backup.sh >> $LOG_FILE 2>&1 $MARKER"
SUDO="${SUDO:-sudo}"

install_cron() {
  (
    crontab -l 2>/dev/null | grep -vF "$MARKER" || true
    echo "$LINE"
  ) | crontab -

  echo "Installed backup cron:"
  echo "$LINE"
}

install_systemd_timer() {
  local user unit timer calendar
  user="$(id -un)"
  unit="/etc/systemd/system/hahasns-backup.service"
  timer="/etc/systemd/system/hahasns-backup.timer"
  calendar="${BACKUP_SYSTEMD_CALENDAR:-*-*-* 03:20:00 Asia/Shanghai}"

  cat <<EOF | $SUDO tee "$unit" >/dev/null
[Unit]
Description=SaotieSNS backup

[Service]
Type=oneshot
User=$user
WorkingDirectory=$ROOT_DIR
ExecStart=/usr/bin/env bash $ROOT_DIR/scripts/backup.sh
EOF

  cat <<EOF | $SUDO tee "$timer" >/dev/null
[Unit]
Description=Run SaotieSNS backup daily

[Timer]
OnCalendar=$calendar
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
EOF

  $SUDO systemctl daemon-reload
  $SUDO systemctl enable --now hahasns-backup.timer

  echo "Installed systemd backup timer:"
  $SUDO systemctl list-timers --all hahasns-backup.timer
}

if command -v crontab >/dev/null 2>&1; then
  install_cron
elif command -v systemctl >/dev/null 2>&1; then
  install_systemd_timer
else
  echo "ERROR: neither crontab nor systemd is available" >&2
  exit 1
fi

#!/usr/bin/env bash
# 紧急回滚：systemd(--user hahasns, :5388) 从 server-nest 退回 Express(SQLite)。
# Express 代码与 SQLite 数据全程未动，回滚是即时的、无损的。
set -euo pipefail

UNIT=$HOME/.config/systemd/user/hahasns.service
BACKUP=$HOME/.config/systemd/user/hahasns.express.bak

echo "==> 恢复 Express systemd unit"
if [ -f "$BACKUP" ]; then
  cp "$BACKUP" "$UNIT"
else
  # 兜底：备份不在时直接重写原始 Express unit
  cat > "$UNIT" <<'UNITEOF'
[Unit]
Description=HahaSNS server
After=network.target

[Service]
WorkingDirectory=/home/tt/hahasns/server
Environment=PORT=5388
ExecStart=/usr/bin/node /home/tt/hahasns/server/src/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
UNITEOF
fi

echo "==> daemon-reload + 重启 (Express 回到 :5388)"
systemctl --user daemon-reload
systemctl --user restart hahasns
sleep 5

B=http://127.0.0.1:5388
HEALTH=$(curl -s --noproxy '*' $B/api/health || true)
echo "health=$HEALTH"
echo "$HEALTH" | grep -q '"ok":true' && echo "✅ 已回滚到 Express(SQLite)。" || echo "⚠️ 健康检查未过，请人工查看 systemctl --user status hahasns"

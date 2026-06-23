#!/usr/bin/env bash
# 切换 systemd(--user hahasns, :5388) 从 Express 到 server-nest(MySQL/Redis)。
# 在生产服务器上运行。可回滚：旧 Express 代码 + SQLite 原样保留，rollback-to-express.sh 一键回退。
#
# 流程（停机窗口仅 schema+migrate 几十秒）：
#   备份旧 unit → 停 Express → 重建 hahasns 库 → 起临时实例建表 → 迁移 SQLite 数据
#   → 写 nest unit → 重启 → 健康+冒烟检查。任何检查失败立即提示回滚。
set -euo pipefail

NEST_DIR=/home/tt/hahasns-nest
EXPRESS_DIR=/home/tt/hahasns/server
SQLITE=/home/tt/hahasns/server/data/hahasns.db
UNIT=$HOME/.config/systemd/user/hahasns.service
BACKUP=$HOME/.config/systemd/user/hahasns.express.bak
DB=hahasns

set -a; source /home/tt/hahasns/.nest-env; source /home/tt/hahasns/.nest-env.root; set +a
export NODE_PATH=$EXPRESS_DIR/node_modules:$NEST_DIR/node_modules
export SQLITE_PATH=$SQLITE DB_NAME=$DB

echo "==> 1/8 备份当前 Express unit → $BACKUP"
cp "$UNIT" "$BACKUP"

echo "==> 2/8 停 Express (停机窗口开始)"
systemctl --user stop hahasns

echo "==> 3/8 重建 MySQL 库 $DB (干净)"
docker exec hahasns-mariadb mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" \
  -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4; GRANT ALL ON $DB.* TO 'hahasns'@'%'; FLUSH PRIVILEGES;"

echo "==> 4/8 临时实例建表 (DB_SYNCHRONIZE=true, :4109)"
( cd "$NEST_DIR" && PORT=4109 DB_SYNCHRONIZE=true DB_NAME=$DB nohup node dist/main.js >/tmp/nest-sync.log 2>&1 & echo $! >/tmp/nest-sync.pid )
for i in $(seq 1 20); do
  curl -s --noproxy '*' http://127.0.0.1:4109/api/health 2>/dev/null | grep -q '"ok":true' && break
  sleep 1
done
kill "$(cat /tmp/nest-sync.pid)" 2>/dev/null || true
sleep 2
echo "    建表完成: $(docker exec hahasns-mariadb mariadb -uhahasns -p"$DB_PASSWORD" $DB -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB';") 张表"

echo "==> 5/8 迁移 SQLite → MySQL"
node "$NEST_DIR/scripts/migrate-sqlite-to-mysql.js" 2>&1 | tail -2

echo "==> 6/8 写 server-nest systemd unit"
cat > "$UNIT" <<UNITEOF
[Unit]
Description=HahaSNS server (NestJS)
After=network.target

[Service]
WorkingDirectory=$NEST_DIR
EnvironmentFile=/home/tt/hahasns/.nest-env
Environment=PORT=5388
Environment=DB_NAME=$DB
Environment=DB_SYNCHRONIZE=false
Environment=UPLOADS_DIR=$EXPRESS_DIR/uploads
Environment=CLIENT_DIST=/home/tt/hahasns/client/dist
ExecStart=/usr/bin/node $NEST_DIR/dist/main.js
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
UNITEOF

echo "==> 7/8 daemon-reload + 重启 (server-nest 上 :5388)"
systemctl --user daemon-reload
systemctl --user restart hahasns
sleep 6

echo "==> 8/8 健康 + 冒烟检查"
B=http://127.0.0.1:5388
HEALTH=$(curl -s --noproxy '*' $B/api/health || true)
POSTS=$(curl -s --noproxy '*' "$B/api/posts" | grep -o '"id":[0-9]*' | wc -l || true)
SPA=$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' $B/ || true)
echo "    health=$HEALTH  feed_ids=$POSTS  spa_root=$SPA"
if echo "$HEALTH" | grep -q '"ok":true' && [ "$POSTS" -gt 0 ] && [ "$SPA" = 200 ]; then
  echo "✅ 切换成功：server-nest 已在 :5388 服务，数据/前端/上传均在。Express 代码+SQLite 保留可回滚。"
else
  echo "❌ 冒烟未通过！立即回滚： bash $NEST_DIR/scripts/rollback-to-express.sh"
  exit 1
fi

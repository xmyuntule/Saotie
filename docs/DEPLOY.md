# Deployment / 部署

HahaSNS 后端是 **server-nest**（NestJS + TypeORM + MySQL/MariaDB + Redis），`app` 进程同时伺服
`/api`、构建后的 SPA 与 `/uploads`——同一个端口。生产部署有两条路：

- **Docker Compose（推荐，最省事）** —— 一份 `docker-compose.yml` 起 `app + mariadb + redis`，
  数据库/缓存一并起好。面板图文教程：[INSTALL-1panel.md](INSTALL-1panel.md) / [INSTALL-bt.md](INSTALL-bt.md)。
- **裸机 systemd（不用 Docker）** —— 自备 MySQL/Redis，把 server-nest 跑成 systemd 服务，见下。

> 把所有 `<占位符>` 换成你自己的值。切勿把真实主机/密码/密钥提交到代码库。

---

## 方式 A：Docker Compose

```bash
cp .env.example .env        # 设 JWT_SECRET、DB_PASSWORD（大陆可设 NPM_REGISTRY 加速）
docker compose up -d --build
curl http://127.0.0.1:4000/api/health   # {"ok":true,"app":"HahaSNS"}
```

`app` 首启自动建表（`DB_SYNCHRONIZE=true`）。数据库/缓存/上传存于命名卷
（`hahasns-db` / `hahasns-redis` / `hahasns-uploads`），重建容器不丢。用面板反向代理把域名转发到
`127.0.0.1:4000` 并申请 HTTPS；大文件上传把反代 `client_max_body_size` 调到 `30m`。
更新：`git pull && docker compose up -d --build`。备份：`docker exec hahasns-mariadb mariadb-dump …`。

---

## 方式 B：裸机 systemd（自备 MySQL/Redis）

### 1. 准备
- **Node.js 18+**（推荐 20 LTS）、**MySQL/MariaDB**、**Redis**。
- 建库 `hahasns` 与用户/密码。
- 一个非 root 部署用户，拥有应用目录（如 `/home/<deploy-user>/hahasns`）。

### 2. 构建
```bash
git clone <your-repo-url> hahasns && cd hahasns
npm run install:all          # 装 server-nest + client 依赖
npm run build                # 构建前端(client/dist) + 编译后端(server-nest/dist)
```

### 3. 环境变量（写进 systemd unit 的 EnvironmentFile 或 Environment=）
| 变量 | 说明 |
| --- | --- |
| `JWT_SECRET` | **必设**，强随机串（`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`） |
| `PORT` | 监听端口，如 `4000` |
| `DB_CLIENT`/`DB_HOST`/`DB_PORT` | `mysql` / `127.0.0.1` / `3306` |
| `DB_USER`/`DB_PASSWORD`/`DB_NAME` | MySQL 用户/密码/库（`hahasns`） |
| `DB_SYNCHRONIZE` | `true` 首启建表；稳定后改 `false` 走迁移 |
| `REDIS_URL` | `redis://127.0.0.1:6379`（有密码：`redis://:pw@127.0.0.1:6379`） |
| `CLIENT_DIST` | `<repo>/client/dist`（伺服前端） |
| `UPLOADS_DIR` | 本地上传目录（未配 `S3_*` 时用）；配了 `S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY` 则走对象存储 |
| `NODE_ENV` | `production` |

### 4. systemd unit（`~/.config/systemd/user/hahasns.service`，或系统级）
```ini
[Unit]
Description=HahaSNS (NestJS)
After=network.target

[Service]
WorkingDirectory=/home/<deploy-user>/hahasns/server-nest
EnvironmentFile=/home/<deploy-user>/hahasns/server-nest/.env
ExecStart=/usr/bin/node /home/<deploy-user>/hahasns/server-nest/dist/main.js
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```
```bash
systemctl --user daemon-reload && systemctl --user enable --now hahasns
curl http://127.0.0.1:4000/api/health
```
前面用 nginx/面板反代绑域名 + HTTPS（转发到 `PORT`）。

### 5. 更新
```bash
cd <repo> && git pull && npm run build && systemctl --user restart hahasns
```
数据在 MySQL（用 `mariadb-dump` 备份）、上传在 `UPLOADS_DIR` 或对象存储，更新切勿覆盖。

---

## 常见问题
| 现象 | 排查 |
| --- | --- |
| 打开 404/白屏 | `client/dist` 构建了吗？`CLIENT_DIST` 指对了吗？ |
| 接口 502 | `curl 127.0.0.1:<PORT>/api/health` 通吗？反代指对端口了吗？ |
| 启动连不上数据库 | `DB_*` 是否正确？MySQL/Redis 在运行吗？（Docker 方式 `DB_HOST=mariadb`） |
| 上传失败 | 反代 `client_max_body_size` ≥ `30m`。 |

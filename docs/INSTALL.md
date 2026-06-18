# 安装手册

本手册带你从零把 HahaSNS 部署起来，覆盖**主机规格**、**依赖环境**与**部署步骤**。HahaSNS 有两套后端，对资源的要求差别很大，按需选择：

- **简版（SQLite）** —— `server/` 目录，基于 Express + 嵌入式 SQLite，**零外部依赖**，最适合本地开发、试用与中小型自托管站点。
- **生产版（MySQL / Redis / S3）** —— `server-nest/` 目录，基于 NestJS + TypeORM，把数据落到 MySQL / PostgreSQL、用 Redis 缓存、用 S3 兼容对象存储托管媒体，适合需要扩展与扛量的生产站点。

> 本手册聚焦「装起来 + 跑起来」。更细的生产运维（systemd / pm2、备份、HTTPS）见 [DEPLOY.md](DEPLOY.md)；纯本地开发见 [DEVELOPMENT.md](DEVELOPMENT.md)；宝塔面板图文教程见 [INSTALL-bt.md](INSTALL-bt.md)。

---

## 一、主机规格

### 简版（SQLite）

| 档位 | 配置 | 适用场景 |
| --- | --- | --- |
| 最低 | 1 核 CPU / 1 GB 内存 / 10 GB 磁盘 / Linux（Ubuntu 20.04+、Debian 11+、CentOS 7+ 等） | 试用、个人站、小流量 |
| 推荐 | 2 核 CPU / 2 GB 内存 / 20 GB 磁盘 | 日常运营的小型社区 |

SQLite 是单文件嵌入式数据库，跟应用同进程运行，几乎不额外占用资源，所以 1 核 1G 的入门云主机即可流畅运行。磁盘主要消耗在**用户上传的媒体**（图片 / 视频 / 音频），如果允许用户上传视频，请按预期内容量预留磁盘。

### 生产版（MySQL / Redis / S3）

| 档位 | 配置 | 适用场景 |
| --- | --- | --- |
| 最低 | 2 核 CPU / 4 GB 内存 / 20 GB 磁盘 | 起步生产站 |
| 推荐 | 4 核 CPU / 8 GB 内存 / 40 GB+ 磁盘，数据库 / 缓存独立部署 | 中大型、高并发站点 |

生产版要同时跑 Node 应用、MySQL/PostgreSQL、Redis，单机至少 4 GB 内存才舒适。规模再大时建议把数据库、Redis、对象存储拆到独立实例或托管服务（云数据库、云 Redis、对象存储 OSS / COS / S3），应用层即可无状态横向扩展。媒体文件交给对象存储后，应用服务器本身几乎不占磁盘。

> 操作系统建议 64 位 Linux。Windows / macOS 可用于开发，但生产部署推荐 Linux。

---

## 二、依赖环境

### 通用

- **Node.js 18+**（推荐 20 LTS）与 **npm**。两套后端都要求 Node 18 及以上。
  ```bash
  node -v   # 应输出 v18.x 或更高
  npm -v
  ```
- **Git**（用于拉取代码，可选；也可上传压缩包）。

### 简版（SQLite）额外说明

- 无需任何外部数据库、缓存或消息队列 —— SQLite 文件在首次运行时自动创建。
- `better-sqlite3` 是 **原生（C++）模块**。它为主流 Node LTS 提供预编译二进制；若你的平台 / Node 组合没有预编译包，会从源码编译，此时需要构建工具：**Python 3** 与 **C/C++ 编译器**（Debian/Ubuntu 装 `build-essential`，CentOS 装 `gcc-c++ make`，macOS 装 Xcode Command Line Tools，Windows 装「使用 C++ 的桌面开发」工作负载）。

### 生产版额外依赖

- **MySQL 8+** 或 **PostgreSQL 13+**（二选一）。
- **Redis 6+**（可选，但强烈建议，用于缓存）。
- **S3 兼容对象存储**（可选，用于存放上传媒体）：可用 AWS S3、MinIO，或阿里云 OSS / 腾讯云 COS 等兼容 S3 协议的服务。
- 上述服务的连接信息（地址、端口、库名、账号、密钥）通过 **环境变量** 注入 `server-nest`，请勿写死在代码或提交到仓库。

---

## 三、获取代码

```bash
# 用 git 拉取（推荐）
git clone <你的仓库地址> hahasns
cd hahasns

# 或：上传 / 解压发布包到服务器某个目录，例如 /opt/hahasns
```

仓库是多包结构：

- `client/` —— 前端（React 19 + HeroUI v3 + TypeScript + Tailwind 4 + Vite）
- `server/` —— 简版后端（Express + SQLite）
- `server-nest/` —— 生产后端（NestJS + TypeORM + MySQL/PostgreSQL + Redis + S3）

---

## 四、部署步骤（简版 · SQLite）

### 1. 构建前端

前端无论搭配哪套后端，构建方式相同：产出静态文件到 `client/dist`。

```bash
cd client
npm install
npm run build       # → 产出 client/dist
```

### 2. 启动后端

```bash
cd ../server
npm install
# 可选：填充演示数据（注意 seed 会重置演示内容，勿用于已有真实数据的库）
# npm run seed
node src/index.js   # → http://localhost:4000
```

后端首次运行会自动创建 SQLite 库（`server/data/hahasns.db`，WAL 模式）。当检测到同级 `client/dist` 存在时，后端会**同时托管前端静态站点**：除 `/api`、`/uploads` 外的路径都返回 `index.html`（SPA 回退）。也就是说，单个 Node 进程即可对外提供「前端 + API + 上传文件」。

生产环境请用进程管理器守护后端，并设置关键环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `4000` | 后端监听端口 |
| `JWT_SECRET` | 内置开发占位值 | 签发登录令牌的密钥，**生产环境必须改为强随机值** |
| `SEED_PASSWORD` | 内置占位值 | seed 脚本为演示账号设置的密码，公开实例前请覆盖 |

生成强随机密钥示例：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

用 pm2 守护（systemd 方案见 [DEPLOY.md](DEPLOY.md)）：

```bash
sudo npm install -g pm2
cd server
NODE_ENV=production PORT=4000 JWT_SECRET=<强随机密钥> \
  pm2 start src/index.js --name hahasns
pm2 save && pm2 startup        # 设置开机自启
```

### 3. 反向代理对外（Nginx）

让 Node 进程绑定本地端口（如 4000），Nginx 在前面提供域名、HTTPS 与上传体积放行。

由于单个 Node 进程已同时托管静态站点、`/api` 与 `/uploads`，最简单的做法是把所有请求整体代理给它：

```nginx
server {
    listen 80;
    server_name <你的域名>;

    # 上传媒体可能较大，放宽请求体上限（应用端单文件上限约 25 MB）
    client_max_body_size 30m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

如果你希望由 Nginx **直接托管 `client/dist` 静态文件**、只把 `/api` 与 `/uploads` 转发给后端（静态资源更快、缓存更可控），用下面这种分流写法：

```nginx
server {
    listen 80;
    server_name <你的域名>;
    client_max_body_size 30m;

    root /opt/hahasns/client/dist;
    index index.html;

    # API 与上传文件转发给后端
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
    }

    # 其余走静态文件，找不到则回退到 SPA 入口
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用并重载，再申请 HTTPS 证书：

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d <你的域名>      # 申请并自动配置 HTTPS
```

记得在云主机安全组 / 防火墙放行 **80 / 443** 端口（后端的 4000 端口只对本机开放即可，不要直接暴露公网）。

---

## 五、部署步骤（生产版 · NestJS + MySQL/Redis/S3）

> 生产版位于 `server-nest/`，前端构建方式与第四节第 1 步完全相同。

### 1. 准备外部服务

- 建好 MySQL（或 PostgreSQL）数据库与账号。
- 准备 Redis 实例（可选）。
- 准备 S3 兼容对象存储的 Bucket 与访问密钥（可选）。

### 2. 配置环境变量并构建

进入 `server-nest/`，通过环境变量（或进程管理器 / 容器的环境配置）提供数据库、Redis、S3 与 JWT 的连接信息，再构建：

```bash
cd server-nest
npm install
npm run build           # nest build → 产出 dist/
```

> 具体支持哪些环境变量，请以 `server-nest/` 的配置模块为准；至少需要数据库连接、`JWT_SECRET`，以及（启用时）Redis 与 S3 的连接 / 密钥信息。所有敏感凭据只放在环境变量里，切勿提交到仓库。

### 3. 启动并守护

```bash
# 生产模式直接跑编译产物
NODE_ENV=production node dist/main.js

# 或用 pm2 守护
pm2 start dist/main.js --name hahasns-nest
pm2 save && pm2 startup
```

### 4. 反向代理

与简版一致：用 Nginx 托管 `client/dist` 静态站点，把 `/api`、`/uploads`（若仍走应用）转发到 NestJS 进程，并配置域名与 HTTPS。参见第四节第 3 步的分流写法。

---

## 六、数据与备份

### 简版（SQLite）

- 数据库：`server/data/hahasns.db`（含 `-wal`、`-shm`，WAL 模式）。
- 上传媒体：`server/uploads/`，对外路径 `/uploads/...`。
- 两个目录都被 git 忽略，且在运行时创建 / 写入。**重新部署代码时务必排除它们**，避免覆盖线上数据与媒体。
- WAL 模式下不要在运行时直接拷贝 `.db` 文件，请用 SQLite 在线备份：
  ```bash
  sqlite3 server/data/hahasns.db ".backup '/var/backups/hahasns-$(date +%F).db'"
  ```

### 生产版

- 数据落在外部 MySQL / PostgreSQL，按数据库自身的备份方案（云数据库自动备份或 `mysqldump` / `pg_dump`）处理。
- 媒体在对象存储中，依赖对象存储自身的冗余与版本控制。

---

## 七、常见问题

- **`better-sqlite3` 安装失败** —— 它是原生 C++ 模块。请确认已装好 **Python 3** 与 **C/C++ 编译器**（见第二节），再到 `server/` 重新 `npm install`。升级 Node 主版本后需重建：`npm rebuild better-sqlite3` 或删 `node_modules` 重装。
- **端口被占用** —— 用不同的 `PORT` 启动后端（如 `PORT=4100 node src/index.js`）。
- **前端能打开但接口报错 / 跨域** —— 检查 Nginx 是否正确把 `/api`、`/uploads` 转发到后端端口；本地开发则确认后端已在 4000 端口运行（前端 dev server 已配置代理）。
- **公网无法访问** —— 检查云主机安全组 / 防火墙是否放行 80 / 443；后端 4000 端口应只对本机开放，由 Nginx 代理对外。
- **演示账号登录失败** —— 确认已执行 `npm run seed`；演示密码为 seed 脚本设置的值，公开部署前请务必修改并改用真实注册。

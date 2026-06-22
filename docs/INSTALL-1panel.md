# 1Panel 部署教程

1Panel 是 Docker 化面板，HahaSNS 用一份 `docker-compose.yml` 一键起容器（单容器同时伺服 前端 + /api + /uploads），再用 1Panel 的反向代理绑域名即可。**你要配的只有：JWT 密钥 + 域名。**

> **🌏 大陆 / 国外**
> - **大陆服务器**：① 在 1Panel「容器 → 配置 → 镜像加速」填一个国内 Docker 加速地址；② 把 `.env` 里的 `NPM_REGISTRY` 取消注释（用 npm 国内镜像）。否则拉基础镜像 / 装依赖会很慢甚至失败。
> - **国外服务器**：什么都不用改，直接用默认。

---

## 一、安装 1Panel + 准备

- 按官网命令安装 1Panel；登录后它会确保 Docker / Docker Compose 就绪。
- **大陆**：进「容器 → 镜像加速」配置国内加速器（按面板提示，一次性）。
- 备一个解析到服务器的域名（可选；没有先用 `IP:端口`）。

---

## 二、拉代码 + 配置（唯一要填的地方）

在 1Panel「主机 → 终端」（或 SSH）：

```bash
cd /opt        # 放哪都行
git clone <仓库地址> hahasns && cd hahasns

cp .env.example .env
# 编辑 .env：把 JWT_SECRET 改成强随机串（生成命令见下）
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
# 【大陆】再把 .env 里这行取消注释：NPM_REGISTRY=https://registry.npmmirror.com
```

`.env` 里就这几项：`JWT_SECRET`（必改）、`APP_PORT`（默认 4000，冲突就改）、可选 `NPM_REGISTRY` / `SEED_PASSWORD` / `ANTHROPIC_API_KEY`。

---

## 三、起容器（二选一）

**方式 A — 1Panel 图形化（推荐）**：「容器 → 编排 → 创建编排」，来源选「本地目录」指到 `/opt/hahasns`（含 `docker-compose.yml`），确认并「构建 + 启动」。

**方式 B — 终端一条命令**：

```bash
cd /opt/hahasns
docker compose up -d --build
```

首次会构建镜像（几分钟）。完成后验证：

```bash
curl http://127.0.0.1:4000/api/health     # 应返回 {"ok":true,"app":"HahaSNS"}
```

（可选）填充演示数据：`docker compose exec app npm run seed` —— **会清空并重置**演示内容，已有真实数据勿执行。

---

## 四、绑域名 + HTTPS（1Panel 反向代理）

1Panel「网站 → 创建网站 → 反向代理」：

- 域名：你的域名
- 代理地址：`http://127.0.0.1:4000`
- 创建后在该网站「HTTPS」里一键申请 Let's Encrypt 证书并开启强制 HTTPS。

浏览器打开域名即用。上传大文件如被拦，在该网站反代配置里把 `client_max_body_size` 调到 `30m`。

---

## 五、更新与数据

```bash
cd /opt/hahasns
git pull
docker compose up -d --build      # 重新构建并滚动重启
```

数据安全：SQLite 库与上传文件存在 Docker **命名卷**（`hahasns-data` / `hahasns-uploads`），`git pull` 与重建容器都不会丢；卷可在 1Panel「容器 → 存储卷」里查看与备份。

---

## 六、常见问题

| 现象 | 排查 |
| --- | --- |
| 构建慢 / 拉镜像失败（大陆） | 配了镜像加速吗？`.env` 的 `NPM_REGISTRY` 取消注释了吗？ |
| 502 / 打不开 | `curl 127.0.0.1:4000/api/health` 通吗？反代地址是否 `http://127.0.0.1:4000`？ |
| 端口冲突 | 改 `.env` 的 `APP_PORT`，重新 `docker compose up -d`。 |
| 上传失败 | 反代里 `client_max_body_size` ≥ `30m`。 |

---

> 需要 MySQL / Redis / S3 的更大规模生产版见仓库 `server-nest/`（NestJS 后端，env 里配数据库 / Redis 连接）。简版 SQLite 已足以支撑中小社区，推荐先用简版。

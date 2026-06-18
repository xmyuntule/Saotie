# 开发手册

本手册面向想在本地参与 HahaSNS 开发的同学，介绍本地开发流程、项目结构、前后端启动、构建打包与常用脚本。

> 想直接部署上线，请看 [INSTALL.md](INSTALL.md) 与 [DEPLOY.md](DEPLOY.md)；宝塔面板教程见 [INSTALL-bt.md](INSTALL-bt.md)。

---

## 一、环境要求

- **Node.js 18+**（推荐 20 LTS）与 **npm**
  ```bash
  node -v   # 应输出 v18.x 或更高
  ```
- **Git**
- 开发默认使用**简版后端**（Express + 嵌入式 SQLite），无需安装任何外部数据库 / 缓存，开箱即用。
- `better-sqlite3` 是原生 C++ 模块，在主流平台有预编译包；个别平台需要 **Python 3** 与 **C/C++ 编译器** 才能从源码编译（详见 [INSTALL.md](INSTALL.md) 第二节）。

---

## 二、获取代码与安装依赖

```bash
git clone <你的仓库地址> hahasns
cd hahasns
```

仓库是多包结构，三套包各自管理依赖：

```bash
cd client && npm install          # 前端
cd ../server && npm install       # 简版后端（SQLite）
cd ../server-nest && npm install  # 生产后端（NestJS，按需）
```

如需用根目录的一键脚本，再在仓库根目录安装一次根依赖（提供 `concurrently`）：

```bash
cd ..
npm install                       # 安装根 devDependency: concurrently
```

---

## 三、本地开发流程

日常开发推荐**前后端各开一个终端**，都带热重载。

### 方式 A：分别启动（推荐，便于看各自日志）

```bash
# 终端 1 —— 后端（--watch 自动重启），端口 4000
cd server
npm run dev          # 等价于 node --watch src/index.js

# 终端 2 —— 前端（Vite dev server），端口 5173
cd client
npm run dev
```

打开 **http://localhost:5173** 即可。前端 dev server 已在 `client/vite.config.js` 中把 `/api`、`/uploads` 代理到 `http://localhost:4000`，所以前端直接用相对路径请求后端，无需关心跨域。

### 方式 B：一条命令同时拉起前后端

在仓库根目录（需先 `npm install` 根依赖）：

```bash
npm run dev
# server 端口 4000，client 端口 5173，日志带颜色区分
```

### 填充演示数据（可选）

后端首次运行会自动建库但内容为空。需要演示用户与内容时：

```bash
cd server
npm run seed         # 依次执行 src/seed.js + src/seed-extra.js
```

- `seed.js` 是**重置式**填充（会清空并重建演示数据），勿在已有真实数据的库上运行。
- `seed-extra.js` 是**幂等**补充，可安全重复执行。
- 也可单独执行：`npm run seed:base`、`npm run seed:extra`。
- 压测大数据量：`node src/seed-bulk.js 1000 10000`（约 1000 用户 / 10000 动态，可自定义目标数，幂等增量）。

> seed 脚本会给演示账号设置统一密码，可用 `SEED_PASSWORD` 环境变量覆盖；公开部署前务必修改。

---

## 四、项目结构

```
hahasns/
├── client/                  # 前端 SPA
│   ├── public/showcase/     # 截图素材
│   ├── src/
│   │   ├── pages/           # 各页面（Home、Forum、Circles、QA、Mall、Admin 等，.tsx）
│   │   ├── components/      # 共享组件（Navbar、Shell、PostCard、Composer、Poll 等）
│   │   ├── context/         # React Context（Auth、Theme、Toast、Compose）
│   │   ├── api/             # Axios 实例（baseURL '/api'，Bearer token）
│   │   └── styles/          # Tailwind 入口与设计 token
│   ├── vite.config.js       # Vite 配置（端口 5173 + /api、/uploads 代理）
│   └── tsconfig.json
│
├── server/                  # 简版后端：Express + better-sqlite3
│   └── src/
│       ├── index.js         # 入口：注册中间件与全部路由，存在 client/dist 时托管前端
│       ├── db.js            # SQLite 连接 + 加载 schema + 轻量迁移
│       ├── schema.sql       # 完整数据库 schema
│       ├── helpers.js       # 等级/经验、用户序列化、通知等共享逻辑
│       ├── sensitive.js     # 敏感词过滤
│       ├── middleware/      # auth 中间件（签发 JWT / optionalAuth / requireAuth / requireAdmin）
│       ├── routes/          # 各功能路由（每个功能一个文件）
│       └── seed*.js         # 演示数据脚本（seed / seed-extra / seed-bulk）
│
├── server-nest/             # 生产后端：NestJS + TypeORM（MySQL/PostgreSQL + Redis + S3）
│   └── src/                 # 19 个功能模块
│
└── docs/                    # 文档目录
```

后端按「功能 = 一个路由文件」组织，`server/src/index.js` 把每个路由以独立前缀挂载（如 `/api/posts`、`/api/forum`、`/api/circles` 等）。前端按「功能 = 一个页面」组织，页面在路由中注册。

---

## 五、构建与打包

### 前端构建

```bash
cd client
npm run build        # vite build → 产出 client/dist 静态文件
npm run preview      # 可选：本地预览构建产物
npm run typecheck    # 可选：tsc --noEmit 类型检查
```

### 简版后端「构建」

简版后端是纯 Node 运行，无需编译。生产运行只需：

```bash
cd server
npm install
node src/index.js    # 若同级存在 client/dist，将一并托管前端
```

也可在仓库根目录用一键脚本「先构建前端再启动后端」：

```bash
npm start            # = npm run build（构建前端） && 启动 server
```

### 生产后端构建

```bash
cd server-nest
npm run build        # nest build → 产出 dist/
node dist/main.js    # 或 npm run start:prod
```

---

## 六、常用脚本速查

### 根目录（`package.json`）

| 脚本 | 作用 |
| --- | --- |
| `npm run install:all` | 同时安装 server 与 client 依赖 |
| `npm run dev` | 同时启动后端与前端 dev server |
| `npm run build` | 构建前端（client） |
| `npm start` | 构建前端后启动简版后端 |
| `npm run seed` | 执行简版后端的演示数据填充 |

### 前端（`client/package.json`）

| 脚本 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Vite dev server（端口 5173） |
| `npm run build` | 生产构建（产出 `client/dist`） |
| `npm run preview` | 预览构建产物 |
| `npm run typecheck` | TypeScript 类型检查 |

### 简版后端（`server/package.json`）

| 脚本 | 作用 |
| --- | --- |
| `npm start` | 启动后端（`node src/index.js`） |
| `npm run dev` | 启动后端并热重启（`node --watch`） |
| `npm run seed` | 填充演示数据（base + extra） |
| `npm run seed:base` / `npm run seed:extra` | 分别执行基础 / 补充填充 |

### 生产后端（`server-nest/package.json`）

| 脚本 | 作用 |
| --- | --- |
| `npm run start` / `npm run start:dev` | 启动 / 热重启 NestJS |
| `npm run build` | 编译（`nest build` → `dist/`） |
| `npm run start:prod` | 运行编译产物（`node dist/main.js`） |
| `npm run lint` / `npm run format` | 代码检查 / 格式化 |

---

## 七、开发小贴士

- **接口约定**：前端 Axios 的 `baseURL` 为 `/api`，登录后携带 Bearer Token；后端健康检查 `GET /api/health` 返回 `{"ok":true,"app":"HahaSNS"}`。
- **新增接口**：在 `server/src/routes/` 下新建路由文件并 `export default router`，在 `server/src/index.js` 用唯一前缀挂载；如需新表 / 字段，在 `db.js` / `schema.sql` 里补充，启动时会自动创建。
- **新增页面**：在 `client/src/pages/` 下新建页面组件并在路由中注册，必要时在左侧导航补一个入口。
- **内容安全**：用户提交的文本应走敏感词过滤（见 `server/src/sensitive.js`），写接口注意用 `requireAuth` / `requireAdmin` 鉴权。
- **代码风格**：全量 ES Module，2 空格缩进，优先沿用所在文件的既有写法与命名。
- 更多接口细节见 [API.md](API.md)，架构说明见 [ARCHITECTURE.md](ARCHITECTURE.md)，配置项见 [CONFIGURATION.md](CONFIGURATION.md)。

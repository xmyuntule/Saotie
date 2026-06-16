# Installation & Local Setup / 安装与本地运行

This guide takes you from a fresh clone to a running HahaSNS instance, with both **dev** (hot-reload) and **production** (single-port) workflows.

## Prerequisites / 环境要求

- **Node.js 18+** (and npm) — `better-sqlite3` ships prebuilt binaries for current Node LTS; on uncommon platforms you may need build tools (Python 3 + a C/C++ toolchain) for native compilation.
- No external database, Redis, or message broker is required. The database is an embedded SQLite file created automatically.

Check your version:

```bash
node -v   # should print v18.x or newer
```

## 1. Clone

```bash
git clone <your-fork-url> hahasns
cd hahasns
```

## 2. Install dependencies / 安装依赖

The repo is a two-package layout: a `server/` (Express) and a `client/` (React/Vite). Install both.

```bash
# from the repo root — installs both packages at once
npm run install:all

# …which is equivalent to:
cd server && npm install
cd ../client && npm install
```

If you want to use the root `npm run dev` convenience script, also install the root dev dependency (`concurrently`):

```bash
# from the repo root
npm install
```

## 3. Configure environment (optional) / 环境变量

The server reads configuration from **process environment variables**. Both have safe
defaults, so this step is optional for local development — you can skip straight to the
next section and everything will work on the default port.

> The server does **not** read a `.env` file (there is no `dotenv` dependency). Set these
> as real environment variables — exported in your shell for dev, or via your process
> manager / container for production (see `docs/DEPLOY.md`).

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Port the API server listens on |
| `JWT_SECRET` | `hahasns-dev-secret-change-me` | Signs auth (JWT) tokens. **Must be changed in any real deployment.** |
| `SEED_PASSWORD` | `hahasns123` | Password given to every account the seed scripts create. Set this before seeding a public instance so demo logins aren't the published default. |

To set them for a local dev session:

```bash
# macOS / Linux (current shell only)
export PORT=4000
export JWT_SECRET="<strong-random-secret>"
```

> ⚠️ The default `JWT_SECRET` is a publicly-known development placeholder. Anyone who knows
> it can forge login tokens for any account. Set a strong, secret value before exposing the
> app on any network — see the production checklist in `docs/DEPLOY.md`.

## 4. Seed demo data / 填充演示数据

The server auto-creates the schema on first run, but starts empty. Seed it with showcase content:

```bash
cd server
npm run seed
```

`npm run seed` runs two scripts in sequence:

- **`src/seed.js`** — **destructive reset** + base data: 12 showcase users, posts (with image/video/audio media and all 5 visibility modes), 10 topics, forum boards + sub-boards + moderators, threads, comments, private messages, notifications, and the points-mall products.
- **`src/seed-extra.js`** — **idempotent** top-up that ensures every topic/board has content and showcase profiles have bookmarks, mall orders, thread replies, notifications, and followed topics. Safe to re-run.

> You can run them individually with `npm run seed:base` and `npm run seed:extra`.

### Optional: bulk / scale seeding

To stress-test the feed, profiles, and pagination at scale, generate up to N users / M posts. This script is **additive and idempotent** — it only creates the delta needed to reach the targets:

```bash
cd server
node src/seed-bulk.js 1000 10000     # → ~1,000 users, ~10,000 posts (defaults)
node src/seed-bulk.js 200 2000       # or pick your own targets
```

All bulk-generated and demo accounts share the password **`hahasns123`**.

## 5. Run

### Dev mode (hot reload) / 开发模式

Runs the API and the Vite dev server together. The client proxies `/api` and `/uploads` to the API.

```bash
# from the repo root (requires root `npm install` for concurrently)
npm run dev
# → client:  http://localhost:5173   (open this)
# → API:     http://localhost:4000
```

Or run each side manually in two terminals:

```bash
# terminal 1 — API with --watch auto-restart
cd server && npm run dev      # http://localhost:4000

# terminal 2 — Vite dev server
cd client && npm run dev      # http://localhost:5173
```

### Production mode (single port) / 生产模式

Build the client to static assets and let the Express server serve both the API and the SPA from one port:

```bash
# build the SPA
cd client && npm run build     # → outputs to client/dist

# start the server (auto-serves client/dist if it exists)
cd ../server && npm start      # → http://localhost:4000
```

Or, from the repo root, do both in one command:

```bash
npm start     # = npm run build && npm --prefix server start
```

When `client/dist` exists, `server/src/index.js` serves it as static files with an SPA fallback (any non-`/api`, non-`/uploads` path returns `index.html`).

## Demo accounts / 演示账号

| Account | Password | Role |
| --- | --- | --- |
| `admin` | `hahasns123` | Administrator (后台管理) |
| `linmu`, `coder_k`, `amy`, `zhaoyun`, `tangtang`, … | `hahasns123` | Regular users |

All seeded users (base + bulk) share `hahasns123`. **Keep these private** and register your own account on any public deployment — the password is intentionally non-trivial so demo logins are not publicly guessable.

## Data & uploads / 数据与上传

- The SQLite database lives at `server/data/hahasns.db` (created on first run, WAL mode).
- Uploaded media is stored under `server/uploads/` and served at `/uploads/...`.
- Both directories are git-ignored. To **reset everything**, stop the server, delete `server/data/`, then re-run `npm run seed`.

## Troubleshooting / 常见问题

- **`better-sqlite3` install fails** — it is a **native** (C++) module. It ships prebuilt binaries for current Node LTS versions, but if your platform/Node combo has no prebuild it compiles from source, which needs build tools: **Python 3** and a **C/C++ toolchain** (`build-essential` on Debian/Ubuntu, the Xcode Command Line Tools on macOS, or the "Desktop development with C++" workload on Windows). Install those, then re-run `npm install` in `server/`.
- **Port already in use** — start the server with a different `PORT` env var (e.g. `PORT=4100 npm start` in `server/`), or change `server.port` in `client/vite.config.js` for the dev client (and update the proxy targets to match the new API port).
- **Login fails for demo users** — make sure you ran `npm run seed`; the password is `hahasns123`, not `123456`.

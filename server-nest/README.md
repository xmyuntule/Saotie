# HahaSNS — NestJS Backend (`server-nest/`)

A NestJS 10 + TypeScript backend that migrates the original Express +
better-sqlite3 API (`../server/`) onto production infrastructure:

- **TypeORM** with an env-driven driver switch — **MySQL** (default) or **PostgreSQL**
- **Redis** cache via `@nestjs/cache-manager` + `ioredis`
- **S3-compatible object storage** (`@aws-sdk/client-s3`), targeting **rustfs** (also MinIO / AWS S3)
- **JWT** auth (`@nestjs/jwt` + `bcryptjs`)
- **class-validator** DTOs

The **Auth**, **Users**, and **Posts** modules are fully ported as the reference
pattern. Endpoint paths (`/api/auth`, `/api/users`, `/api/posts`, `/api/upload`,
`/api/health`) and JSON response shapes match the Express version **exactly**, so
the existing client works unchanged.

---

## Architecture

```
src/
├── main.ts                      # bootstrap: CORS, 10mb JSON, ValidationPipe, error filter
├── app.module.ts                # root module — wires infra + feature modules
├── app.controller.ts            # GET /api/health
├── config/
│   └── configuration.ts         # all env vars in one typed config object
├── common/                      # cross-cutting, @Global
│   ├── common.module.ts         # JwtModule + HelpersService + guards (global)
│   ├── helpers.service.ts       # publicUser / notify / award / level curve / parsers
│   ├── sensitive.ts             # ported sensitive-word filter (checkSensitive)
│   ├── decorators/current-user.decorator.ts   # @CurrentUser() -> req.user
│   ├── guards/jwt-auth.guard.ts               # JwtAuthGuard (requireAuth) + AdminGuard
│   ├── guards/optional-auth.guard.ts          # OptionalAuthGuard (optionalAuth)
│   └── filters/http-exception.filter.ts       # normalizes errors to { error: "..." }
├── database/
│   ├── database.module.ts       # TypeOrmModule.forRootAsync — mysql|postgres switch
│   └── entities/                # one file per table (columns mirror ../server schema)
│       ├── user, post, comment, follow, like      (core, per the brief)
│       ├── topic, bookmark, block, notification    (referenced by ported modules)
│       ├── purchase, reward, product, order
│       ├── poll (polls + poll_options + poll_votes)
│       └── circle (circles + circle_members)
└── modules/
    ├── cache/redis-cache.module.ts     # Redis cache (REDIS_URL)
    ├── storage/                        # S3-compatible object storage
    │   ├── storage.module.ts
    │   ├── storage.service.ts          # upload / delete / signed URLs
    │   └── uploads.controller.ts       # POST /api/upload (multipart, field "files")
    ├── auth/                           # /api/auth  (ported)
    ├── users/                          # /api/users (ported)
    └── posts/                          # /api/posts (ported)
```

### Design notes

- **Response parity.** `HelpersService.publicUser()` and `PostsService.serializePost()`
  reproduce the Express JSON shapes field-for-field (booleans via `!!`, camelCase
  keys, nested `levelProgress`, `poll`, `shared`, anonymous-author masking, etc.).
- **Error parity.** A global exception filter rewrites every error to
  `{ error: "<message>" }` with the original status code (400/401/402/403/404/409),
  matching what the client reads from `err.response.data.error`.
- **Timestamps.** Columns are stored as `'YYYY-MM-DD HH:MM:SS'` strings
  (`HelpersService.nowSql()`) to stay shape-compatible with the SQLite-era data.
- **`media`** stays a JSON string in the `posts` table (parsed on read), exactly
  as before.
- **Route ordering.** Controllers declare static / multi-segment routes before
  the catch-all `:id` / `:username` routes so matching matches Express precedence.
- **Portability.** Entity column types are chosen to work on both MySQL and
  Postgres; booleans use `smallint` 0/1. A couple of hot-path updates use raw SQL
  with a Postgres fallback (`ON CONFLICT` / `$n` placeholders).

---

## Environment variables

Copy `.env.example` to `.env` and fill in. Summary:

| Var | Purpose | Default |
| --- | --- | --- |
| `PORT` | HTTP port | `4000` |
| `JWT_SECRET` | token signing secret | dev placeholder |
| `JWT_EXPIRES_IN` | token lifetime | `30d` |
| `DB_CLIENT` | `mysql` or `postgres` | `mysql` |
| `DB_HOST` / `DB_PORT` | database host/port | `127.0.0.1` / 3306 (5432 for pg) |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | credentials + db | — |
| `DB_SYNCHRONIZE` | auto-create tables (dev only) | `false` |
| `DB_LOGGING` | SQL logging | `false` |
| `REDIS_URL` | Redis connection | `redis://127.0.0.1:6379` |
| `REDIS_TTL` | default cache TTL (ms) | `30000` |
| `S3_ENDPOINT` | rustfs / MinIO / S3 endpoint | `http://127.0.0.1:9000` |
| `S3_BUCKET` | bucket name | `hahasns` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | credentials | — |
| `S3_REGION` | region | `us-east-1` |
| `S3_FORCE_PATH_STYLE` | path-style addressing (rustfs/MinIO) | `true` |
| `S3_PUBLIC_URL` | public base URL for media (optional CDN) | derived |

> Secrets are placeholders only — never commit a real `.env`.

---

## Running

### Prerequisites

- Node 18+ (developed on Node 22)
- A MySQL **or** PostgreSQL server, a Redis server, and an S3-compatible store
  (rustfs / MinIO / S3). Create the database and bucket up front.
- For the **first run**, set `DB_SYNCHRONIZE=true` so TypeORM creates the tables
  from the entities, then turn it back off and rely on migrations.

### Install & build

```bash
cd server-nest
npm install
npm run build          # compiles to dist/  (verified: builds clean)
```

### Develop

```bash
cp .env.example .env   # then edit credentials
npm run start:dev      # watch mode
```

### Production

```bash
npm run build
npm run start:prod     # node dist/main.js
```

Health check: `GET http://localhost:4000/api/health` → `{ "ok": true, "app": "HahaSNS" }`

---

## Ported endpoints (reference pattern)

**`/api/auth`** — `POST register`, `POST login`, `GET me`, `POST password`,
`POST checkin`, `POST change-username`

**`/api/users`** — `GET mention`, `GET me/bookmarks`, `GET me/blocks`,
`PUT me/profile`, `POST me/recharge`, `GET ranking/checkin`, `GET ranking/:type`,
`GET suggestions`, `POST :id/block`, `GET :id/blocked`, `POST :id/follow`,
`GET :username/:rel`, `GET :username`

**`/api/posts`** — `GET /` (feed), `POST /` (create), `GET user/:username`,
`GET liked/:username`, `GET :id/related`, `GET :id/siblings`, `POST :id/vote`,
`POST :id/share`, `POST :id/like`, `POST :id/unlock`, `POST :id/reward`,
`POST :id/pin`, `POST :id/global-pin`, `POST :id/bookmark`, `PUT :id`,
`DELETE :id`, `GET :id`

**`/api/upload`** — `POST /` (multipart `files`, up to 9 → S3)

---

## Remaining modules to port

Each follows the same pattern as auth/users/posts (entity → DTOs → service →
controller → module, then register in `app.module.ts`). The corresponding
Express routes live in `../server/src/routes/`.

- [ ] **comments** — `comments.js` (nested comments on posts & threads, likes)
- [ ] **forum** — `forum.js` (boards, threads, replies, moderators, board follows)
- [ ] **circles** — `circles.js` (entities already defined: `circles`, `circle_members`)
- [ ] **qa** — `qa.js` (questions / answers / answer votes — needs new entities)
- [ ] **flash** — `flash.js` (资讯快报 / news feed — needs `flash` entity)
- [ ] **nav** — `nav.js` (网址导航 — needs `nav_categories`, `nav_links` entities)
- [ ] **achievements** — `achievements.js` (`user_badges`, `task_claims` entities)
- [ ] **mall** — `mall.js` (products / orders — entities already defined)
- [ ] **messages** — `messages.js` (私信 — needs `messages`, `conversation_settings`)
- [ ] **notifications** — `notifications.js` (`notifications` entity already defined)
- [ ] **topics** — `topics.js` (`topics` entity already defined; topic follows)
- [ ] **search** — `search.js` (cross-entity search)
- [ ] **reports** — `reports.js` (举报 — needs `reports` entity)
- [ ] **feedback** — `feedback.js` (问题反馈 — needs `feedback` entity)
- [ ] **admin** — `admin.js` (uses the `AdminGuard` already provided)

When porting:

1. Add any missing entities under `src/database/entities/` and register them in
   `entities/index.ts`.
2. Reuse `HelpersService` (publicUser / notify / award / parsers), the auth
   guards, `@CurrentUser()`, and `checkSensitive` rather than re-implementing.
3. Keep response shapes identical to the Express route so the client is unaffected.
4. Swap local-disk media for `StorageService` (S3) where the old code wrote to
   `/uploads`.

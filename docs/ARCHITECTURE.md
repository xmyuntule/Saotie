# HahaSNS — Architecture

HahaSNS is a single-repo, full-stack web application: a React single-page app (SPA) talking to an Express REST API backed by SQLite. The whole product runs from one Node process in production (the API also serves the built SPA), which keeps deployment to a single artifact.

---

## 1. High-level overview

```
                            ┌──────────────────────────────────────────────┐
                            │                  Browser (SPA)                │
                            │   React 18 + React Router + HeroUI + Tailwind │
                            │                                                │
                            │   ThemeContext ─ 6 skins × light/dark          │
                            │   AuthContext  ─ JWT in localStorage           │
                            │   axios client ─ baseURL "/api"                │
                            └───────────────┬────────────────────────────────┘
                                            │  HTTPS  (JSON over /api/*, JWT Bearer)
                                            ▼
        ┌───────────────────────────────────────────────────────────────────────┐
        │                        Express server (Node)                           │
        │                                                                        │
        │   middleware:  CORS → JSON body → optionalAuth (decode JWT if present) │
        │                                                                        │
        │   /api/auth   /api/users   /api/posts   /api/comments  /api/forum      │
        │   /api/circles /api/qa     /api/polls*  /api/flash      /api/nav        │
        │   /api/achievements /api/mall /api/messages /api/notifications          │
        │   /api/topics /api/search  /api/reports  /api/feedback  /api/admin      │
        │   /api/upload  ── multer ──► server/uploads/                            │
        │                                                                        │
        │   helpers: award() · notify() · publicUser() · checkSensitive()        │
        │   guards:  requireAuth · requireAdmin                                  │
        │                                                                        │
        │   static:  serves client/dist (built SPA) + /uploads in production     │
        └───────────────────────────────┬───────────────────────────────────────┘
                                         │  synchronous queries (better-sqlite3)
                                         ▼
              ┌────────────────────────────────────────────────────────┐
              │                 SQLite  (server/data/)                   │
              │   users · posts · comments · likes · follows · topics    │
              │   boards · threads · circles · circle_members            │
              │   polls · poll_options · poll_votes                      │
              │   questions · answers · answer_votes                     │
              │   flash · nav_categories · nav_links                     │
              │   user_badges · task_claims · products · orders          │
              │   messages · notifications · reports · feedback …        │
              │   schema + idempotent migrations applied on boot (db.js) │
              └────────────────────────────────────────────────────────┘

  * polls are attached to posts and served through /api/posts (vote endpoint), not a top-level router.
```

---

## 2. Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| UI framework | **React 18** + **React Router v6** | SPA, client-side routing |
| Components | **HeroUI v2** (`@heroui/react`) | themed primitives (Card, Tabs, Input, Modal, …) |
| Styling | **Tailwind CSS 3** (preflight off) + a hand-rolled CSS token system | `styles/tokens.css → base → layout → components → pages` |
| Motion | **framer-motion** | page transitions, micro-interactions (reduced-motion aware) |
| Build | **Vite** | dev server proxies `/api` + `/uploads` to the API |
| Server | **Express** (ESM) | thin REST controllers, one file per domain |
| Database | **SQLite** via **better-sqlite3** | synchronous driver; file under `server/data/` |
| Auth | **JWT** (`jsonwebtoken`) + **bcryptjs** | stateless bearer tokens |
| Uploads | **multer** | images/video/audio → `server/uploads/` |

---

## 3. Repository layout

```
hahasns/
├── client/                     # React SPA (Vite)
│   ├── src/
│   │   ├── pages/              # one component per route (Home, Circles, QA, Mall, …)
│   │   ├── components/         # shared UI (PostCard, Composer, Shell, Icon, …)
│   │   ├── context/           # AuthContext, ThemeContext, ToastContext, ComposeContext
│   │   ├── api/client.js       # axios instance (baseURL /api, attaches JWT)
│   │   ├── lib/                # formatting + helpers
│   │   ├── styles/            # tokens.css, base.css, layout.css, components.css, pages.css
│   │   └── App.jsx            # route table
│   └── tailwind.config.cjs     # HeroUI plugin + 6 skins × light/dark themes
│
├── server/                     # Express API
│   └── src/
│       ├── index.js           # app wiring + route registration + static SPA serving
│       ├── db.js              # SQLite open + schema + idempotent migrations + indexes
│       ├── routes/            # one router per domain (auth, posts, circles, qa, …)
│       ├── middleware/auth.js  # optionalAuth / requireAuth
│       ├── helpers.js         # award, notify, publicUser, parseMentions, …
│       ├── sensitive.js       # content moderation word filter
│       └── seed*.js           # seed.js (base) · seed-extra.js (demo) · seed-bulk.js (scale)
│
└── docs/                       # README, INSTALL, DEPLOY, API, CONFIGURATION, ARCHITECTURE
```

---

## 4. Request lifecycle

1. The SPA calls `api.get('/posts')`; the axios client prefixes `/api` and attaches `Authorization: Bearer <jwt>` if a token is in `localStorage`.
2. Express runs `cors → express.json → optionalAuth`. `optionalAuth` decodes the JWT (if any) and sets `req.user`; it never rejects.
3. The matching router handles the request. Endpoints that mutate or read private data wrap themselves in `requireAuth` (401 if no valid token); admin endpoints additionally check `req.user.role === 'admin'`.
4. Controllers run **synchronous** better-sqlite3 queries directly (no async/await on the data layer), serialize rows with helpers like `publicUser()` / `serializePost()`, and return JSON.
5. Side effects flow through shared helpers: `award()` (exp/points), `notify()` (notifications, skips self), `checkSensitive()` (moderation on create paths).

---

## 5. Data & theming notes

- **Schema management** — `db.js` runs `CREATE TABLE IF NOT EXISTS` plus an `ensureColumn()` migration helper on every boot, so the schema self-heals and new columns/tables are additive. Hot paths have explicit indexes.
- **Seeding** — `seed.js` creates the base demo world (destructive reset), `seed-extra.js` is idempotent demo enrichment, and `seed-bulk.js` procedurally scales to thousands of users/posts for load testing. The seed password is configurable via `SEED_PASSWORD`.
- **Theming** — `ThemeContext` sets `data-theme` (light/dark), `data-skin`, and a HeroUI theme class on `<html>`. Six color skins × light/dark are generated by the HeroUI Tailwind plugin and bridged into the custom CSS via design tokens (`--brand`, `--surface`, `--ink`, …).
- **Single-port production** — `npm run build` emits `client/dist`; in production the Express server serves that static bundle plus `/uploads`, so the entire app is one origin and one process.

See [INSTALL.md](INSTALL.md) to run it, [API.md](API.md) for the endpoint reference, [CONFIGURATION.md](CONFIGURATION.md) for env/ops, and [DEPLOY.md](DEPLOY.md) for production.

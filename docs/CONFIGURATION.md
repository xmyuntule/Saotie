# Configuration & Maintenance

Runtime configuration, the admin account, seeding, content filtering, file uploads, and backup for a HahaSNS deployment. For first-time install and run instructions see [`INSTALL.md`](INSTALL.md); for deployment see [`DEPLOY.md`](DEPLOY.md).

## Environment variables

HahaSNS reads configuration from process environment variables. None are strictly required to *start* the server, but production deployments **must** set `JWT_SECRET`.

| Variable | Default | Description |
| --- | --- | --- |
| `JWT_SECRET` | `hahasns-dev-secret-change-me` (insecure fallback) | Secret used to sign and verify JWT auth tokens. The built-in fallback exists only so the app boots in local development. **In production you MUST set a strong, random value** (e.g. a long random string from a password manager or `openssl rand`). Anyone who knows the secret can forge login tokens for any account, so treat it like a password and never commit it. Changing the secret invalidates all existing sessions. |
| `PORT` | `4000` | TCP port the Express API listens on. |
| `SEED_PASSWORD` | `hahasns123` | Password assigned to every account created by the seed scripts (`seed.js`, `seed-bulk.js`). The default is a local convenience only — set a private value (and re-seed, or change the admin password directly in the DB) before exposing a public instance, so the published default can't be used to log in. |

Set them before launching the server, for example:

```bash
JWT_SECRET="<your-strong-random-secret>" PORT=4000 npm --prefix server start
```

(Use a real secrets mechanism — environment file with restricted permissions, systemd `Environment=`, container secret, etc. — rather than inlining the value in scripts you commit.)

## Admin account

The base seed creates a single privileged `admin` account (role `admin`) with a **default password set by the seed script**.

> **Security: change the admin password immediately after your first deploy.** The default seed password is publicly known (it ships in the source), so any internet-reachable instance using it is effectively open. After seeding, log in as `admin` (password `<changed-by-seed>`) and change the password right away via the account settings, or remove/replace the account before exposing the service.

The public is expected to register their own accounts; `admin` is only for site operation and moderation.

## Seeding scripts

All seed scripts live in `server/src/` and operate on the SQLite database. Run them from the `server/` directory (or with `npm --prefix server`).

| Script | Purpose | Notes |
| --- | --- | --- |
| `seed.js` | **Base seed — DESTRUCTIVE.** Resets the database to a clean known state (core users including `admin`, demo posts, boards, etc.). | Wipes/overwrites existing seeded data. Run on a fresh setup, not against a populated production DB you care about. |
| `seed-extra.js` | **Additive demo enrichment.** Layers extra demo content (more posts, threads, interactions) on top of the base seed. | Non-destructive enrichment; intended to run after `seed.js`. |
| `seed-bulk.js` | **Procedural bulk generation** for scale/performance testing. Generates large numbers of synthetic users and posts. | Usage: `node src/seed-bulk.js [users] [posts]` (defaults: 1000 users, 10000 posts). It tops the DB up toward the target counts. |

Convenience scripts are defined in `server/package.json`:

```bash
npm --prefix server run seed         # seed.js + seed-extra.js
npm --prefix server run seed:base    # seed.js only
npm --prefix server run seed:extra   # seed-extra.js only

# bulk generation (run directly to pass counts)
cd server && node src/seed-bulk.js 1000 10000
```

Because `seed.js` is destructive, **back up first** (see below) if a database has anything you want to keep.

## Sensitive-word content filter

User-generated text is screened by a lightweight content filter in `server/src/sensitive.js`. It normalizes input (lowercasing and stripping spacing/punctuation between characters to resist evasion) and checks it against a built-in word list covering common moderation categories.

The filter is applied on content-creation endpoints (posts, comments, threads, messages, etc.): submissions that match are rejected with a validation error so the content is never stored. To tune moderation for your community, edit the word list in `server/src/sensitive.js`. Note this is a demo-grade filter, not a substitute for full moderation tooling.

## File uploads

Image/file uploads are handled with **multer** using disk storage. Uploaded files are written to `server/uploads/` and served statically at the `/uploads` URL path. Upload type/size limits and the multer configuration live in `server/src/routes/upload.js`.

When backing up or migrating an instance, treat `server/uploads/` as part of your data — the database stores references (URLs) to these files, not the file contents themselves.

## SQLite data file & backup

HahaSNS uses an embedded SQLite database (via `better-sqlite3`) stored under `server/` in the `server/data/` directory (the `data/` directory is created automatically on first run). The database runs in WAL mode, so alongside the main `.db` file you will also see `-wal` and `-shm` companion files.

**What to back up**

- The SQLite database file (and its `-wal` / `-shm` companions) under `server/data/`.
- The `server/uploads/` directory (user-uploaded media referenced by the database).

**How to back up safely**

To get a consistent copy, either:

1. **Stop the service** first, then copy the database file (plus `-wal`/`-shm`) and the `uploads/` directory; or
2. Use a proper **SQLite backup** (e.g. the `sqlite3` CLI `.backup` command or the SQLite Online Backup API) to snapshot the live database without stopping it, then copy `uploads/` separately.

Avoid copying the `.db` file with a plain `cp` while the server is running and writing — doing so can capture an inconsistent state because of in-flight WAL writes. Restore by stopping the service and putting the backed-up database file and `uploads/` directory back in place.

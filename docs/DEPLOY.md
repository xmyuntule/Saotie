# Deployment / 部署

HahaSNS is a **single Node process** that serves both the JSON API and the built React
SPA on one port. There is no external database, cache, or message broker to provision —
the database is an embedded **SQLite** file created automatically on first boot.

This guide describes a **generic, reproducible production deployment** that anyone can
follow on their own server:

1. Build the client.
2. Run the Node server under a **process manager** (systemd or pm2).
3. Put it behind a **reverse proxy** (nginx) for a domain + TLS.
4. Set `JWT_SECRET` and `PORT`.
5. **Persist and back up** the SQLite data file and the uploads directory.

Throughout, replace every `<placeholder>` with your own value. Never commit real hosts,
passwords, or secrets to source control.

---

## 1. Prerequisites on the server

- **Node.js 18+** and npm (same major version you will keep using — see the
  better-sqlite3 note below).
- Build tools for native modules in case `better-sqlite3` has no prebuilt binary for your
  platform: **Python 3** + a **C/C++ toolchain** (`build-essential` on Debian/Ubuntu).
- A non-root **deploy user** (referred to below as `<deploy-user>`) that owns the app
  directory.

> ### ⚠️ better-sqlite3 is a native module — match the Node ABI
> `better-sqlite3` compiles (or downloads a prebuilt binary) against a specific
> **Node.js ABI**. A `node_modules` tree built on one machine/Node version is **not**
> portable to another with a different Node major version or ABI. Practical rules:
> - **Run `npm install` on the target server** (or inside the exact runtime image), not
>   on your laptop, so the binary matches.
> - If you **upgrade Node** on the server, reinstall/rebuild:
>   `npm rebuild better-sqlite3` (or delete `node_modules` and `npm install`).
> - If you build in CI or Docker, use the **same Node major version** there as in
>   production.

---

## 2. Get the code onto the server

Clone (or upload a release tarball of) the repository as your deploy user. A common
layout is `/home/<deploy-user>/hahasns` or `/opt/hahasns`.

```bash
# as <deploy-user>
git clone <your-repo-url> hahasns
cd hahasns
```

---

## 3. Build the client and install server deps

Build the SPA to static assets, then install **production-only** server dependencies on
the server (this is where the native better-sqlite3 binary gets matched to the runtime).

```bash
# from the repo root, on the server
npm --prefix client install
npm --prefix client run build          # → client/dist

npm --prefix server install --omit=dev # production deps only
```

When `client/dist` exists, `server/src/index.js` serves it as static files with an SPA
fallback (any non-`/api`, non-`/uploads` path returns `index.html`). So the single Node
process now serves both the API and the front end.

> Optional one-time demo content: `npm --prefix server run seed`. Note that `seed.js` is
> **destructive** — it wipes and re-creates demo data. Do **not** run it against a
> database that has real users. See `docs/INSTALL.md` for details.

---

## 4. Configuration / environment variables

The server reads configuration from **process environment variables** (there is no `.env`
file support). Set these in whatever runs the process — your systemd unit, pm2 ecosystem
file, or container environment.

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | Port the Node process listens on. |
| `JWT_SECRET` | `hahasns-dev-secret-change-me` | **Must be set** to a strong random value in production — it signs login tokens. |
| `NODE_ENV` | _(unset)_ | Set to `production`. |

Generate a strong secret, e.g.:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Keep `<strong-random-secret>` out of source control — store it only in the unit file /
secrets manager, readable solely by the deploy user.

---

## 5. Run under a process manager

Pick **one** of the following. Both keep the app running across crashes and reboots.

### Option A — systemd (system service)

Create `/etc/systemd/system/hahasns.service`:

```ini
[Unit]
Description=HahaSNS
After=network.target

[Service]
Type=simple
User=<deploy-user>
WorkingDirectory=/home/<deploy-user>/hahasns/server
ExecStart=/usr/bin/node src/index.js
Environment=NODE_ENV=production
Environment=PORT=<app-port>
Environment=JWT_SECRET=<strong-random-secret>
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hahasns
sudo systemctl status hahasns
journalctl -u hahasns -f          # follow logs
```

> Prefer not to bake the secret into the unit file? Put your `Environment=` lines in a
> root-only file (e.g. `/etc/hahasns.env`) and reference it with
> `EnvironmentFile=/etc/hahasns.env` instead.

> Running rootless under a user service is also fine — use
> `~/.config/systemd/user/hahasns.service`, `systemctl --user enable --now hahasns`, and
> `loginctl enable-linger <deploy-user>` so it survives logout.

### Option B — pm2

```bash
sudo npm install -g pm2

cd /home/<deploy-user>/hahasns/server
NODE_ENV=production PORT=<app-port> JWT_SECRET=<strong-random-secret> \
  pm2 start src/index.js --name hahasns

pm2 save                 # remember the process list
pm2 startup              # print the command to run so pm2 restarts on boot
pm2 logs hahasns
```

A reusable `ecosystem.config.cjs` is cleaner if you redeploy often:

```js
module.exports = {
  apps: [{
    name: 'hahasns',
    script: 'src/index.js',
    cwd: '/home/<deploy-user>/hahasns/server',
    env: {
      NODE_ENV: 'production',
      PORT: '<app-port>',
      JWT_SECRET: '<strong-random-secret>',
    },
  }],
};
```

```bash
pm2 start ecosystem.config.cjs
```

Verify the app is up either way:

```bash
curl http://localhost:<app-port>/api/health     # → {"ok":true,"app":"HahaSNS"}
```

---

## 6. Reverse proxy (nginx) + TLS

Run the Node process bound to a local port (`<app-port>`) and put nginx in front for the
public domain, request limits, and HTTPS. Example `/etc/nginx/sites-available/hahasns`:

```nginx
server {
    listen 80;
    server_name <your-domain>;

    # Uploaded media can be large; raise nginx's body limit to match the app
    # (the server itself caps JSON at 10 MB and uploads at 25 MB/file).
    client_max_body_size 30m;

    location / {
        proxy_pass http://127.0.0.1:<app-port>;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it and reload:

```bash
sudo ln -s /etc/nginx/sites-available/hahasns /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Add HTTPS with a free certificate (recommended — login tokens travel over this connection):

```bash
sudo certbot --nginx -d <your-domain>
```

The API, uploads, and SPA are all served from the same upstream origin, so no extra proxy
rules are needed for `/api` or `/uploads` — they are handled by the single Node process.

---

## 7. Persist & back up data / 数据持久化与备份

Two directories under `server/` hold all stateful data. They are **git-ignored** and are
created/written at runtime — make sure your deploy process never overwrites or deletes
them:

| Path | Contents |
| --- | --- |
| `server/data/hahasns.db` (+ `-wal`, `-shm`) | The SQLite database (WAL mode). |
| `server/uploads/` | User-uploaded media, served at `/uploads/...`. |

When you redeploy by replacing the code, **exclude** `server/data` and `server/uploads`
from whatever you copy/extract so live data and media survive the deploy. (If you deploy
with Docker, mount these as named volumes / bind mounts so they outlive container
rebuilds.)

### Backups

Because the DB runs in **WAL mode**, do not just copy `hahasns.db` while the app is
running — use SQLite's online backup so the copy is consistent:

```bash
# consistent online backup (safe while the server is running)
sqlite3 /home/<deploy-user>/hahasns/server/data/hahasns.db \
  ".backup '/var/backups/hahasns/hahasns-$(date +%F).db'"

# back up uploaded media too
tar czf /var/backups/hahasns/uploads-$(date +%F).tgz \
  -C /home/<deploy-user>/hahasns/server uploads
```

Schedule both with cron/systemd-timer and keep copies off-box. To restore, stop the
service, drop the backup DB into `server/data/hahasns.db` (remove stale `-wal`/`-shm`
files), restore `uploads/`, then start the service again.

---

## 8. Updating / redeploying

```bash
# as <deploy-user>, in the repo
git pull
npm --prefix client install && npm --prefix client run build
npm --prefix server install --omit=dev     # re-matches the native better-sqlite3 binary
sudo systemctl restart hahasns             # or: pm2 restart hahasns
curl http://localhost:<app-port>/api/health
```

`server/data` and `server/uploads` are untouched by a code update, so users and media
persist. The server also applies small additive schema migrations automatically on boot.

---

## Production checklist / 上线清单

- [ ] **Set a strong `JWT_SECRET`** (env var). The default is a publicly-known dev
      placeholder — leaving it lets anyone forge login tokens.
- [ ] Set `NODE_ENV=production` and a fixed `PORT`.
- [ ] Run under a process manager (systemd or pm2) so it restarts on crash and on boot.
- [ ] Put HahaSNS behind a reverse proxy (nginx / Caddy) for **TLS / HTTPS** and a domain.
- [ ] Raise the proxy body-size limit to ≥ the app's upload cap (uploads are limited to
      **25 MB/file**; JSON bodies to **10 MB**).
- [ ] Persist `server/data/` (SQLite DB) and `server/uploads/` (media); exclude them from
      code deploys.
- [ ] Schedule off-box backups (use `sqlite3 .backup` for the DB — WAL mode — plus the
      uploads dir).
- [ ] Confirm the server's **Node version matches** the one `better-sqlite3` was built
      against; rebuild after any Node upgrade.
- [ ] Change/remove the seeded demo accounts (all share `hahasns123`) or start from an
      empty database before going public.

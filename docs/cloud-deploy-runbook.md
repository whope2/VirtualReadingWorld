# Cloud Deployment Runbook (SQLite Default)

Read first: [cloud-read-first.md](cloud-read-first.md)

This runbook prepares and deploys Virtual Reading World to the cloud VM using SQLite as the default database for low-resource environments.

## Scope

- Local feature development remains on SQLite.
- Cloud deployment also runs on SQLite.
- PostgreSQL remains optional through environment variables but is not the default.

## Release policy

- Non-schema release (default): preserve cloud DB data.
- Schema-change release (opt-in reset): back up cloud DB, then recreate schema/data from empty DB.

Treat every deployment as non-schema unless a schema reset is explicitly approved.

## 1. Local Release Gate

Run these checks from your local workspace before packaging:

```bash
cd backend && npm install && npm run build && npm run test:sqlite
cd ../world && npm install && npm run build
curl -s --max-time 5 http://127.0.0.1:4000/health
curl -s --max-time 5 http://127.0.0.1:4000/api/active-reader-limit
```

Expected:

- Backend compiles
- SQLite smoke test passes
- Frontend build succeeds
- API health endpoints return JSON

## 2. Build Artifact Prep

From repo root:

```bash
tar --exclude='backend/node_modules' --exclude='world/node_modules' --exclude='backend/data' --exclude='backend/.env' -czf virtual-reading-world-vm-build.tar.gz backend world docs ops README.md
```

Important:

- Do not package `backend/data/*` from local; cloud profile history lives in the VM database file.
- Do not package `backend/.env`; keep cloud environment settings managed on the VM.

Copy artifact to VM:

```bash
scp virtual-reading-world-vm-build.tar.gz <vm-user>@<vm-host>:/home/<vm-user>/
```

## 3. VM Deploy Steps

SSH to VM and unpack:

```bash
ssh <vm-user>@<vm-host>
mkdir -p /home/<vm-user>/VirtualReadingWorld
cd /home/<vm-user>/VirtualReadingWorld
tar -xzf /home/<vm-user>/virtual-reading-world-vm-build.tar.gz
```

Install and build backend:

```bash
cd /home/<vm-user>/VirtualReadingWorld/backend
npm install
npm run build
```

Install and build frontend:

```bash
cd /home/<vm-user>/VirtualReadingWorld/world
npm install
npm run build
```

Canonical frontend path policy:

- Deploy frontend assets only to `/home/<vm-user>/VirtualReadingWorld/world/dist/`.
- Keep `/home/<vm-user>/VirtualReadingWorld/frontend` as a symlink to that path for nginx compatibility.

Verify on VM:

```bash
readlink -f /home/<vm-user>/VirtualReadingWorld/frontend
```

Expected output:

```text
/home/<vm-user>/VirtualReadingWorld/world/dist
```

## 4. Backend Environment (SQLite)

Create backend env file:

```bash
cat >/home/<vm-user>/VirtualReadingWorld/backend/.env <<'EOF'
DB_TYPE=sqlite
DATABASE_FILE=/home/<vm-user>/VirtualReadingWorld/backend/data/virtual-reading-world.sqlite
PORT=4000
EOF
```

Create data directory:

```bash
mkdir -p /home/<vm-user>/VirtualReadingWorld/backend/data
```

Database handling during deploy:

- Non-schema release:
	- Keep existing `/home/<vm-user>/VirtualReadingWorld/backend/data/virtual-reading-world.sqlite` unchanged.
	- Do not copy local `backend/data/*` to VM.
- Schema-change release (reset):
	- Back up existing DB first.
	- Stop backend service.
	- Remove `/home/<vm-user>/VirtualReadingWorld/backend/data/virtual-reading-world.sqlite*`.
	- Start backend service so schema is recreated.

## 5. Backend Service (systemd)

Use [ops/systemd/virtual-reading-world-backend.service.example](../ops/systemd/virtual-reading-world-backend.service.example) as the template.

Install service:

```bash
sudo cp /home/<vm-user>/VirtualReadingWorld/ops/systemd/virtual-reading-world-backend.service.example /etc/systemd/system/virtual-reading-world-backend.service
sudo systemctl daemon-reload
sudo systemctl enable virtual-reading-world-backend
sudo systemctl restart virtual-reading-world-backend
sudo systemctl status virtual-reading-world-backend --no-pager
```

## 6. Nginx Routing

Use [ops/nginx/virtual-reading-world.nginx.conf.example](../ops/nginx/virtual-reading-world.nginx.conf.example) as reference.

Goal for this step:

- Keep the existing Hugo site on `readingisalifestyle.com` unchanged.
- Add only two new location blocks inside the existing SSL server block:
	- `/virtualreadingworld/` for app static assets
	- `/api/` proxy to backend

Safe procedure:

```bash
sudo cp /etc/nginx/sites-available/readingisalifestyle.com /etc/nginx/sites-available/readingisalifestyle.com.bak-$(date +%Y%m%d%H%M%S)
```

Then merge only the location blocks from [ops/nginx/virtual-reading-world.nginx.conf.example](../ops/nginx/virtual-reading-world.nginx.conf.example) into your existing `server_name readingisalifestyle.com;` block.

Do not remove or replace your Hugo `location /` handling.

After applying your host-specific nginx file:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Smoke Tests (Cloud)

Run on VM:

```bash
curl -s http://127.0.0.1:4000/health
curl -s http://127.0.0.1:4000/api/active-reader-limit
```

Run externally:

```bash
curl -I https://readingisalifestyle.com/virtualreadingworld/
curl -s https://readingisalifestyle.com/api/active-reader-limit
```

## 8. Rollback

If deployment fails:

1. Restore previous backend folder or previous release symlink.
2. Restore previous frontend `dist` assets.
3. Restart backend service.
4. Reload nginx.
5. Re-run health checks.

Data rollback for schema-reset releases:

1. Stop backend service.
2. Restore a `.bak` copy of `virtual-reading-world.sqlite`.
3. Start backend service.
4. Re-run `/health` and `/api/profiles/all` checks.

Nginx-specific quick rollback:

```bash
sudo cp /etc/nginx/sites-available/readingisalifestyle.com.bak-<timestamp> /etc/nginx/sites-available/readingisalifestyle.com
sudo nginx -t
sudo systemctl reload nginx
```

## 9. Optional PostgreSQL Fallback

You can switch later without code changes by setting:

- `DB_TYPE=postgres`
- `DATABASE_URL=postgres://...`

The app defaults to SQLite when these are not set.

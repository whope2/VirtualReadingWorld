# Virtual Reading World

A peaceful browser-based reading world experience.

## Current scaffold

- `backend/` — Node.js + Express backend with the profile API and SQLite persistence.
- `world/` — React + Vite frontend connected to the backend through the Vite proxy.
- `docs/milestones.md` — milestone plan for Milestone 0–3.

## Test locally

Prerequisites: Node.js 20 or later and npm. Open two terminals from the project root. Run `npm install` once in each app directory; repeat it only after dependencies change.

### 1) Start the backend API

```bash
cd /Users/maxwang/Projects/git/Copilot/Virtual\ Reading\ World/backend
npm install
npm run dev
```

Leave this terminal running. The API listens at:

```text
http://localhost:4000/health
```

### 2) Start the frontend app

In a second terminal:

```bash
cd /Users/maxwang/Projects/git/Copilot/Virtual\ Reading\ World/world
npm install
npm run dev -- --host 0.0.0.0
```

Leave this terminal running, then open the URL Vite prints. It will usually be:

```text
http://localhost:5175/
```

If port `5173` or `5174` is already in use, Vite may automatically move to the next available port. The frontend sends its `/api` requests to the backend through its Vite proxy, so both processes must be running.

### 3) Verify the app

Open the frontend URL and enter a reader name such as:

```text
localtest
```

The login flow should route to the app screen after the backend responds successfully. Stop either development server with `Ctrl+C` in its terminal when testing is complete.

### Quick API health check

You can verify the backend is responding before logging in:

```bash
curl http://localhost:4000/api/profile/localtest
```

That should return a JSON profile response instead of an error.

## Manual Cloud Deployment

This is the standard non-schema release procedure. It preserves the live SQLite database and does not change Nginx or the Hugo site. Read `docs/cloud-read-first.md` before deploying.

Each cloud release has one version in `VERSION`, using Semantic Versioning (`MAJOR.MINOR.PATCH`). Before releasing, increment `VERSION` and add a dated summary to `CHANGELOG.md`. The current release is `0.1.1`.

From this project directory, build and package the release. Do not include `backend/data` or `node_modules`: the VM owns the production reader data and must install its Linux-native dependencies itself.

```bash
cd /Users/maxwang/Projects/git/Copilot/Virtual\ Reading\ World
RELEASE_VERSION=$(tr -d '\n' < VERSION)
cd backend && npm run build && npm run test:sqlite
cd ../world && npm run build
cd ..
tar --exclude='backend/node_modules' --exclude='world/node_modules' --exclude='backend/data' --exclude='backend/.env' -czf "virtual-reading-world-v${RELEASE_VERSION}.tar.gz" backend world docs ops README.md VERSION CHANGELOG.md
```

Upload the archive to the production VM:

```bash
gcloud compute scp "virtual-reading-world-v${RELEASE_VERSION}.tar.gz" whope2@instance-2:/home/whope2/ --project=first-project-297916 --zone=us-east4-a
```

Deploy it on the VM, reinstall the backend's production dependencies, and restart the existing service:

```bash
gcloud compute ssh whope2@instance-2 --project=first-project-297916 --zone=us-east4-a
cd /home/whope2/VirtualReadingWorld
tar -xzf "/home/whope2/virtual-reading-world-v${RELEASE_VERSION}.tar.gz"
cd backend
rm -rf node_modules
npm ci --omit=dev
sudo systemctl restart virtual-reading-world-backend
systemctl is-active virtual-reading-world-backend
curl -s http://127.0.0.1:4000/health
readlink -f /home/whope2/VirtualReadingWorld/frontend
```

The service status should be `active`, the health check should return JSON with `"status":"ok"`, and the symlink should resolve to `/home/whope2/VirtualReadingWorld/world/dist`. Then verify the public deployment:

```bash
curl -I https://readingisalifestyle.com/virtualreadingworld/
curl -s https://readingisalifestyle.com/api/active-reader-limit
```

Do not run a database reset unless the release intentionally includes a schema migration. The schema-reset procedure and rollback guidance are in `docs/cloud-read-first.md` and `docs/cloud-deploy-runbook.md`.

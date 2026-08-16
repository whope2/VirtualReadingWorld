# Cloud Deployment Read First

Read this file before any cloud deployment work.

Recent journal:

- `docs/deployment-journal-2026-08-08.md`

## Non-negotiable rules

- Do not modify nginx unless explicitly requested.
- Do not modify or disturb the Hugo website.
- Deploy frontend assets to one canonical path only:
  - `/home/whope2/VirtualReadingWorld/world/dist/`
- Keep compatibility symlink in place:
  - `/home/whope2/VirtualReadingWorld/frontend -> /home/whope2/VirtualReadingWorld/world/dist`
- Keep SQLite as default in cloud and local.
- Default upgrade policy: preserve existing cloud SQLite data for all non-schema releases.
- Schema-change policy: only recreate DB schema/data when explicitly planned for a breaking schema reset.
- The nginx app route must support both URLs by redirecting:
   - `/virtualreadingworld` -> `/virtualreadingworld/`

## Upgrade policy for future releases

Use this decision rule before every deployment:

- If there is no database schema change:
   - Do not overwrite `/home/whope2/VirtualReadingWorld/backend/data/virtual-reading-world.sqlite`.
   - Do not package `backend/data/*` in deployment artifacts.
   - Keep existing cloud profile/book data in place.
- If there is a schema change and you choose a reset migration:
   - First back up the current DB file on VM.
   - Then recreate schema by replacing the DB file and restarting backend.
   - Initialize fresh data after startup (new profiles are created on first use).

## Current known-good cloud target

- Project: `first-project-297916`
- Zone: `us-east4-a`
- VM instance: `instance-2`
- App URL: `https://readingisalifestyle.com/virtualreadingworld/`
- API URL: `https://readingisalifestyle.com/api/active-reader-limit`

## Safe update procedure (no nginx edits)

1. Build locally:
   - `cd backend && npm run build`
   - `cd ../world && npm run build`
2. Create artifact without database files:
   - `cd ..`
   - `tar --exclude='backend/node_modules' --exclude='world/node_modules' --exclude='backend/data' --exclude='backend/.env' -czf virtual-reading-world-vm-build.tar.gz backend world docs ops README.md`
3. Upload artifact to VM.
4. Update backend code and frontend build files.
5. Reinstall backend dependencies on VM:
   - `cd /home/whope2/VirtualReadingWorld/backend && npm install --omit=dev`
6. Restart backend service:
   - `sudo systemctl restart virtual-reading-world-backend`
7. Verify:
   - `systemctl is-active virtual-reading-world-backend`
   - `curl -s http://127.0.0.1:4000/health`
   - `curl -I https://readingisalifestyle.com/virtualreadingworld/`
   - `curl -s https://readingisalifestyle.com/api/active-reader-limit`

## Schema-change reset procedure (destructive, opt-in only)

Run only when you intentionally want a fresh DB after a schema change.

1. Back up current DB on VM:
   - `cd /home/whope2/VirtualReadingWorld/backend/data`
   - `cp -f virtual-reading-world.sqlite virtual-reading-world.sqlite.$(date +%Y%m%d-%H%M%S).bak`
2. Stop backend:
   - `sudo systemctl stop virtual-reading-world-backend`
3. Remove current SQLite files:
   - `rm -f /home/whope2/VirtualReadingWorld/backend/data/virtual-reading-world.sqlite*`
4. Start backend:
   - `sudo systemctl start virtual-reading-world-backend`
5. Verify new DB is initialized:
   - `curl -s http://127.0.0.1:4000/health`
   - `curl -s https://readingisalifestyle.com/api/profiles/all`

## Common failure to avoid

- Never copy `node_modules` from macOS to Linux VM.
- Never package or upload `backend/data/*` from local to cloud; this can overwrite cloud reader profiles and reading history.
- If `sqlite3` fails with `invalid ELF header`, remove VM `node_modules`, run `npm install --omit=dev`, and restart service.
- Do not leave backup vhost files inside `/etc/nginx/sites-enabled/`; nginx will load them and create conflicting server blocks.

## Pre-flight checklist

- `readlink -f /home/whope2/VirtualReadingWorld/frontend` points to `/home/whope2/VirtualReadingWorld/world/dist`
- Backend `.env` exists with SQLite settings.
- Backend data directory exists:
  - `/home/whope2/VirtualReadingWorld/backend/data`
- `curl -I https://readingisalifestyle.com/virtualreadingworld` returns `301` to `/virtualreadingworld/`

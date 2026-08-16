# Deployment Journal — 2026-08-08

This journal records the cloud deployment and cloud-environment cleanup completed on 2026-08-08.

## Summary

- Deployed the latest Virtual Reading World backend and frontend to the Google Cloud VM.
- Kept the existing Hugo website on `readingisalifestyle.com` intact.
- Standardized cloud runtime on SQLite.
- Recovered backend service after a native module mismatch.
- Consolidated frontend deployment to one canonical path.
- Fixed app routing so both `/virtualreadingworld` and `/virtualreadingworld/` work.

## Cloud Target

- Project: `first-project-297916`
- Zone: `us-east4-a`
- VM: `instance-2`
- Domain: `https://readingisalifestyle.com`
- App path: `https://readingisalifestyle.com/virtualreadingworld/`

## Local Preparation

- Verified local backend health and API responses.
- Ran SQLite smoke test locally.
- Built backend for production.
- Built frontend for production.
- Created deployment artifact:
  - `virtual-reading-world-vm-build.tar.gz`

## Deployment Actions

### 1. Uploaded artifact to VM

- Uploaded the build archive to `/home/whope2/` on the VM.

### 2. Updated backend and frontend code

- Unpacked the deployment archive on the VM.
- Updated backend application files.
- Updated frontend build files.

### 3. Restored backend runtime

- Found that the expected backend systemd service was missing.
- Created and enabled `virtual-reading-world-backend.service`.
- Restored backend `.env` with SQLite configuration.
- Recreated backend data directory.

### 4. Fixed native dependency issue

- Backend initially failed with `sqlite3` native module load errors.
- Root cause: Linux VM was trying to load a macOS-built binary from copied `node_modules`.
- Fix:
  - removed backend `node_modules` on the VM
  - ran `npm install --omit=dev` on the VM
  - restarted backend service

### 5. Fixed frontend deploy-path mismatch

- Backend was updated, but browser still showed the old UI.
- Root cause: nginx served `/home/whope2/VirtualReadingWorld/frontend/`, while the new build had been copied to `/home/whope2/VirtualReadingWorld/world/dist/`.
- Fix:
  - copied the latest frontend build into the path nginx was serving
  - then replaced `/home/whope2/VirtualReadingWorld/frontend` with a symlink to `/home/whope2/VirtualReadingWorld/world/dist`

## Final Canonical Paths

- Frontend canonical deploy path:
  - `/home/whope2/VirtualReadingWorld/world/dist/`
- Frontend compatibility symlink:
  - `/home/whope2/VirtualReadingWorld/frontend -> /home/whope2/VirtualReadingWorld/world/dist`
- Backend path:
  - `/home/whope2/VirtualReadingWorld/backend`
- SQLite database path:
  - `/home/whope2/VirtualReadingWorld/backend/data/virtual-reading-world.sqlite`

## Nginx and Routing Notes

- The Hugo site root was preserved.
- The app remains served as a subpath under the main domain.
- Added exact-match redirect behavior so:
  - `/virtualreadingworld` -> `/virtualreadingworld/`
- Removed accidental duplicate loaded backup config from `sites-enabled`.

## Final Verified State

- Backend service status: active
- Backend health endpoint: `http://127.0.0.1:4000/health` returned `{"status":"ok"}`
- Public API: `https://readingisalifestyle.com/api/active-reader-limit` returned `{"limit":10}`
- Public app route:
  - `https://readingisalifestyle.com/virtualreadingworld` returns `301`
  - `https://readingisalifestyle.com/virtualreadingworld/` returns `200`
- Phone confirmed latest UI after frontend path fix.

## Lessons Learned

- Do not copy `node_modules` from macOS to the Linux VM.
- Always reinstall backend dependencies on the VM after deploying backend code.
- Treat `world/dist/` as the only real frontend deploy path.
- Keep `frontend` only as an nginx compatibility symlink.
- Do not leave backup vhost files inside `/etc/nginx/sites-enabled/`.

## Follow-up References

- Read first: `docs/cloud-read-first.md`
- Runbook: `docs/cloud-deploy-runbook.md`
- Deployment notes: `docs/deployment-notes.md`

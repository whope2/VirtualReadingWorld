# Deployment Journal — 2026-08-09

This journal records the domain rollout, nginx routing updates, and frontend sync completed on 2026-08-09.

## Summary

- Added `virtualreadingworld.com` as a second public hostname for the Virtual Reading World app.
- Kept the Hugo site on `readingisalifestyle.com` intact.
- Redirected the legacy app path on the old domain to the new canonical domain.
- Fixed a blank-page issue caused by the VM serving an older frontend build.
- Expanded the existing TLS certificate to cover the new domain names.

## Cloud Target

- Project: `first-project-297916`
- Zone: `us-east4-a`
- VM: `instance-2`
- Old domain: `https://readingisalifestyle.com/`
- Legacy app path: `https://readingisalifestyle.com/virtualreadingworld/`
- New domain: `https://virtualreadingworld.com/`

## Domain and DNS Updates

- Confirmed the Cloud DNS zone for `virtualreadingworld.com` already existed.
- Added DNS records for:
  - `virtualreadingworld.com` -> `34.21.92.52`
  - `www.virtualreadingworld.com` -> CNAME to `virtualreadingworld.com`
- Verified the authoritative Cloud DNS nameservers were serving the new records.

## Frontend Update

- Found that the new domain was serving a blank page because the live HTML still referenced the older `/virtualreadingworld/` asset path.
- Changed the Vite build base to relative paths so the same compiled app can run from both the new root domain and the old subpath.
- Rebuilt the frontend locally and synced the rebuilt `world/dist` bundle to the VM.
- Confirmed the deployed `index.html` now references relative assets.

## Nginx Routing Changes

- Rewrote the live nginx site file so:
  - `readingisalifestyle.com` still serves the Hugo site at `/`
  - `readingisalifestyle.com/virtualreadingworld/` redirects to `https://virtualreadingworld.com/`
  - `virtualreadingworld.com` serves the app at `/`
  - `/api/` continues to proxy to the backend on `http://127.0.0.1:4000`
- Reloaded nginx after validating the configuration.

## TLS Updates

- Expanded the existing Let’s Encrypt certificate with Certbot so it covers:
  - `readingisalifestyle.com`
  - `www.readingisalifestyle.com`
  - `virtualreadingworld.com`
  - `www.virtualreadingworld.com`

## Final Verified State

- `https://virtualreadingworld.com/` returns `200`
- `https://readingisalifestyle.com/virtualreadingworld/` returns `301` to the new domain
- `https://virtualreadingworld.com/api/active-reader-limit` returns `{"limit":10}`
- `https://readingisalifestyle.com/` still returns the Hugo homepage

## Lessons Learned

- A blank page on the new domain can come from a stale frontend bundle, not nginx.
- Relative frontend asset paths are safer when the same app must serve from multiple hostnames.
- When adding a second hostname, expand the existing certificate instead of creating a separate routing path for the same app.

## Follow-up References

- Read first: `docs/cloud-read-first.md`
- Runbook: `docs/cloud-deploy-runbook.md`
- Deployment notes: `docs/deployment-notes.md`
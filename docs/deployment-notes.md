# Deployment Notes

## Overview

This document summarizes how the Virtual Reading World app is served on the VM, including the HTTPS certificate setup and the nginx routing for the main site, Discourse, and the Virtual Reading World app.

## Database baseline

- Use SQLite for both local and cloud environments.
- Keep backend configuration aligned with resource constraints on the cloud VM.
- For normal version upgrades, preserve existing cloud DB data and never overwrite `/home/whope2/VirtualReadingWorld/backend/data/virtual-reading-world.sqlite`.
- Only for explicit schema-change resets: back up DB, recreate schema, and initialize fresh data.
- Recommended environment values for backend:
  - `DB_TYPE=sqlite`
  - `DATABASE_FILE=/home/whope2/VirtualReadingWorld/backend/data/virtual-reading-world.sqlite`

## Domains and hosts

- Main site: readingisalifestyle.com
- Discourse: community.readingisalifestyle.com
- App path: https://readingisalifestyle.com/virtualreadingworld/

## TLS certificates

Certificates are managed by Certbot and stored under the Let’s Encrypt live directory:

- Main site certificate:
  - /etc/letsencrypt/live/readingisalifestyle.com/fullchain.pem
  - /etc/letsencrypt/live/readingisalifestyle.com/privkey.pem
- Discourse certificate:
  - /etc/letsencrypt/live/community.readingisalifestyle.com/fullchain.pem
  - /etc/letsencrypt/live/community.readingisalifestyle.com/privkey.pem

Each hostname uses its own nginx server block and its own certificate.

## nginx routing

Nginx routes requests based on the hostname and path:

- readingisalifestyle.com
  - serves the main site
  - serves the Virtual Reading World app at /virtualreadingworld/
  - proxies API requests from /api/ to the backend on http://127.0.0.1:4000
- community.readingisalifestyle.com
  - proxies to the Discourse instance on http://127.0.0.1:8080

## App file locations

- Canonical frontend deploy path:
  - /home/whope2/VirtualReadingWorld/world/dist/
- Nginx compatibility path (symlink):
  - /home/whope2/VirtualReadingWorld/frontend -> /home/whope2/VirtualReadingWorld/world/dist
- Backend files:
  - /home/whope2/VirtualReadingWorld/backend
- Backend runtime:
  - http://127.0.0.1:4000

## Important behavior

- The Virtual Reading World app is not a separate domain; it is served as a subpath of the main site.
- The existing Hugo site on `readingisalifestyle.com` remains the primary root site.
- Deploy frontend updates to one path only: `/home/whope2/VirtualReadingWorld/world/dist/`.
- The app uses nginx to route:
  - /virtualreadingworld/ → frontend files
  - /api/ → backend process

## Useful commands

Check nginx config:

```bash
sudo nginx -t
```

Reload nginx:

```bash
sudo nginx -s reload
```

Check certificates:

```bash
sudo certbot certificates
```

Verify the app over HTTPS:

```bash
curl -I https://readingisalifestyle.com/virtualreadingworld/
```

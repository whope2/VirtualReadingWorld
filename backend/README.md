# Virtual Reading World Backend

This backend provides a minimal REST API for Milestone 0 and Milestone 1.

## Local setup

1. Copy `.env.example` to `.env`.
2. Ensure `DB_TYPE=sqlite` (or leave it unset, since SQLite is the default).
3. Optionally set `DATABASE_FILE` (for example `data/virtual-reading-world.sqlite`).
4. Run `npm install`.
5. Start with `npm run dev`.

## API

- `GET /api/profile/:username` — returns an existing profile or creates a default one.
- `GET /health` — simple health check.

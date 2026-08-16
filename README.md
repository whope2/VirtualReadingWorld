# Virtual Reading World

A peaceful browser-based reading world experience.

## Current scaffold

- `backend/` — Node.js + Express backend with a basic `/api/profile/:username` endpoint.
- `world/` — React + Vite frontend connected to the backend proxy.
- `docs/milestones.md` — milestone plan for Milestone 0–3.

## Next steps

### Backend
1. Install dependencies:
   - `cd backend && npm install`
2. Use SQLite by default in `backend/.env`:
   - `DB_TYPE=sqlite`
   - `DATABASE_FILE=./data/virtual-reading-world.sqlite`
   - Optional fallback: switch to PostgreSQL later with `DB_TYPE=postgres` and `DATABASE_URL=...`
3. Start the backend:
   - `npm run dev`

### Frontend
1. Install dependencies:
   - `cd world && npm install`
2. Start the app:
   - `npm run dev`

### Deployment
- Read first: `docs/cloud-read-first.md`
- Deploy the frontend build to `/world` on your Google Cloud VM.
- Proxy `/api` to the backend server via Nginx.
- Verify the frontend can reach `/api/profile/:username`.

# Virtual Reading World — API Specification (Milestone 1)

Base URL:
`/api`

No authentication required.

## Active Reader Limit

### GET /api/active-reader-limit

Returns the current active-reader limit.

#### Example
```bash
curl http://localhost:4000/api/active-reader-limit
```

### PUT /api/active-reader-limit

Updates the active-reader limit.

#### Example
```bash
curl -X PUT http://localhost:4000/api/active-reader-limit \
  -H "Content-Type: application/json" \
  -d '{"limit":12}'
```

---

## Announcement (Global, Read-only)

### GET /api/announcement

Returns the global announcement message for the app-wide scene overlay.

This endpoint is read-only for clients. To publish/update announcements,
edit the backend text file directly:

- `backend/data/announcement.txt` (local)
- `/home/whope2/VirtualReadingWorld/backend/data/announcement.txt` (cloud VM)

#### Example
```bash
curl http://localhost:4000/api/announcement
```

### Response
```json
{
  "message": "Happy reading day! Bring your coziest book and a warm drink.",
  "updatedAt": "2026-08-15T12:00:00.000Z"
}
```

---

## 1. Get or Create Profile

### GET /api/profile/:username

Returns user profile if exists, otherwise creates default profile.

#### Example
```bash
curl http://localhost:4000/api/profile/Fox
```

### Response
```json
{
  "username": "max",
  "currentBookIndex": 0,
  "books": [
    {
      "title": "King Sorrow",
      "author": "Joe Hill",
      "format": "physical",
      "progressMode": "pages",
      "currentProgress": 120,
      "totalProgress": 420,
      "currentRating": 4.5
    },
    {
      "title": "",
      "author": "",
      "format": "physical",
      "progressMode": "pages",
      "currentProgress": 0,
      "totalProgress": 0,
      "currentRating": 0
    },
    {
      "title": "",
      "author": "",
      "format": "physical",
      "progressMode": "pages",
      "currentProgress": 0,
      "totalProgress": 0,
      "currentRating": 0
    }
  ],
  "currentBook": "King Sorrow",
  "currentAuthor": "Joe Hill",
  "currentPage": 120,
  "totalPageCount": 420,
  "progressMode": "pages",
  "favoriteAuthors": ["Stephen King"],
  "status": "reading"
}
```

### PUT /api/profile/:username

Updates a profile, including whether the reader is active.

For multi-book support, send:

- `books`: array of up to 3 book slots
- `currentBookIndex`: `0`, `1`, or `2` for which slot is shown in the scene

Each `books[i]` item:

- `title`: string
- `author`: string
- `format`: `physical | ebook | audiobook`
- `progressMode`: `pages | audio` (derived from format in server logic)
- `currentProgress`: non-negative integer
- `totalProgress`: non-negative integer
- `currentRating`: number between `0` and `5`, supporting half stars like `3.5` and `4.5`; `0` means “Not rated”

#### Example: remove a user
```bash
curl -X PUT "http://localhost:4000/api/profile/Fox" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}'
```

### GET /api/profiles

Returns the currently active reader profiles.

#### Example: list all active readers
```bash
curl -s http://localhost:4000/api/profiles | python3 -c "import sys, json; data=json.load(sys.stdin); active=[p.get('username') for p in data if p.get('isActive')]; print('\n'.join(active))"
```

### GET /api/profiles/all

Returns every stored profile in the database, regardless of whether it is currently active.

#### Example: list all stored profiles
```bash
curl -s http://localhost:4000/api/profiles/all | python3 -c "import sys, json; data=json.load(sys.stdin); print('\n'.join(p.get('username') for p in data))"
```
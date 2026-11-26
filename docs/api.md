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
- `imageData`: optional image data URL for the book cover; send an empty string to remove it. Omitting it preserves the existing image.
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

### POST / DELETE /api/profile/:username/status-like

Adds (`POST`) or removes (`DELETE`) one like on a reader's reading status/mood message shown in the scene. The body must contain the status text being liked, so a like meant for old text is not applied after the reader changes it.

The count is stored as `statusLikeCount` on the profile (also returned by `GET /api/profiles`) and resets to 0 whenever the status text changes. It never goes below 0.

```bash
curl -X POST http://localhost:4000/api/profile/Fox/status-like \
  -H "Content-Type: application/json" \
  -d '{"status":"coffee break"}'
```

```json
{ "username": "Fox", "status": "coffee break", "statusLikeCount": 1, "applied": true }
```

`applied` is `false` (and the count is unchanged) when the sent status no longer matches the reader's current one. Returns `404` for an unknown profile and `400` if `status` is missing.

### POST / DELETE /api/profile/:username/books/:bookIndex/feeling-like

Adds or removes a like for a book's feeling note. Send the current `title` and `feeling` in the JSON body; the endpoint returns `409` if either no longer matches. The response includes the updated `feelingLikeCount` and profile. The count resets when the feeling or book title changes and never goes below zero.

```bash
curl -X POST http://localhost:4000/api/profile/Fox/books/0/feeling-like \
  -H "Content-Type: application/json" \
  -d '{"title":"King Sorrow","feeling":"A lovely read."}'
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

---

## Daily Bulletin (Forum)

Asynchronous posts. Posts from today and yesterday are retained; posts older than yesterday are removed at the next five-minute maintenance run or Bulletin API request. Each post has a globally unique numeric `postId` (shown as `#id` in the UI), which is not reused after rollover or deletion.

### GET /api/bulletin/posts

Returns posts from today and yesterday, newest first.

```bash
curl -s http://localhost:4000/api/bulletin/posts
```

### POST /api/bulletin/posts

Creates a post. `author` is required, plus `text` and/or `imageData` (a `data:image/...` URL). Optional: `avatarIcon`, `avatarImageData`.

```bash
curl -X POST http://localhost:4000/api/bulletin/posts \
  -H "Content-Type: application/json" \
  -d '{"author":"Fox","text":"Finished my book today!"}'
```

### POST / DELETE /api/bulletin/posts/:postId/like

Adds (`POST`) or removes (`DELETE`) one like on a post.

```bash
curl -X POST http://localhost:4000/api/bulletin/posts/3/like
curl -X DELETE http://localhost:4000/api/bulletin/posts/3/like
```

### DELETE /api/bulletin/posts/:postId

Deletes a post from either retained day. Only the author can do this: send the author name in the body. Returns `403` for anyone else and `404` if the post does not exist or has expired.

```bash
curl -X DELETE http://localhost:4000/api/bulletin/posts/3 \
  -H "Content-Type: application/json" \
  -d '{"author":"Fox"}'
```

### Admin: delete a post by index

Localhost only. Run it on the server itself; requests that come through the web server (or carry an `X-Forwarded-For` header) get `403`.

```bash
curl -X DELETE http://127.0.0.1:4000/api/admin/bulletin/posts/3
```

### Admin: reset the whole board

```bash
curl -X POST http://127.0.0.1:4000/api/admin/bulletin/reset
```

---

## Live Book Chat

Real-time chat about books. Messages from today and yesterday are retained; messages older than yesterday are removed at the next five-minute maintenance run or chat API request. Each message has a globally unique numeric `messageId` (shown as `#id` in the UI), which is not reused after a daily rollover or deletion.

### GET /api/chat/messages

Returns messages from today and yesterday in ascending id order, plus the ids and like counts of every retained message that still exists.

- `day`: the `dayKey` the client last saw (empty on the first call).
- `after`: only return messages with an id above this value. Ignored when `day` is not today's date, in which case all retained messages are returned.

```bash
curl -s "http://localhost:4000/api/chat/messages?day=&after=0"
```

```json
{
  "dayKey": "2026-10-11",
  "messages": [
    {
      "dayKey": "2026-10-11",
      "messageId": 1,
      "author": "Max",
      "avatarIcon": "📚",
      "avatarImageData": "",
      "text": "How do you like it?",
      "imageData": "",
      "createdAt": 1791728016198,
      "toUsername": "Reader2",
      "toAvatarIcon": "📚",
      "toAvatarImageData": "",
      "bookTitle": "Beach Read",
      "likeCount": 0
    }
  ],
  "messageIds": [1],
  "likeCounts": { "1": 0 }
}
```

`messageIds` and `likeCounts` cover every retained message (not only the new ones), so clients can drop deleted or expired messages and refresh like counts on messages they already hold.

### POST / DELETE /api/chat/messages/:messageId/like

Adds (`POST`) or removes (`DELETE`) one like. The count never goes below 0. Returns the updated message, or `404` if it does not exist.

```bash
curl -X POST http://localhost:4000/api/chat/messages/1/like
curl -X DELETE http://localhost:4000/api/chat/messages/1/like
```

### POST /api/chat/messages

Posts a message. `author` is required, plus `text` and/or `imageData`. To address the first message to another reader, also send `toUsername`, and optionally `toAvatarIcon`, `toAvatarImageData` and `bookTitle`. `bookTitle` is ignored when `toUsername` is empty.

```bash
curl -X POST http://localhost:4000/api/chat/messages \
  -H "Content-Type: application/json" \
  -d '{"author":"Max","text":"How do you like it?","toUsername":"Reader2","bookTitle":"Beach Read"}'
```

### DELETE /api/chat/messages/:messageId

Deletes a message. Only the author can do this: send the author name in the body. Returns `403` for anyone else and `404` if the message does not exist.

```bash
curl -X DELETE http://localhost:4000/api/chat/messages/1 \
  -H "Content-Type: application/json" \
  -d '{"author":"Max"}'
```

### Admin: delete a message by index

Localhost only, same rules as the Forum admin commands. Run it on the server:

```bash
curl -X DELETE http://127.0.0.1:4000/api/admin/chat/messages/1
```

### Chat requests (bell notification)

Clicking Chat on another reader's profile creates a request for that reader, who sees a bell badge until it is cleared. One request is kept per sender, per day.

```bash
# create a request from Max to Reader2
curl -X POST http://localhost:4000/api/chat/pings \
  -H "Content-Type: application/json" \
  -d '{"from":"Max","to":"Reader2","bookTitle":"Beach Read"}'

# list Reader2's pending requests
curl -s http://localhost:4000/api/chat/pings/Reader2

# clear them
curl -X DELETE http://localhost:4000/api/chat/pings/Reader2
```
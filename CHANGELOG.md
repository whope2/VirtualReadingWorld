# Changelog

This project uses Semantic Versioning. Update `VERSION` and add an entry here before each cloud release.

## 0.1.9 - 2026-11-14

- Added optional book cover images to book slots and the scene profile popup.
- Enabled chat with ghost readers and readers who visited today, including those who have left.
- Updated the scene popup layout and book cover controls.

## 0.1.8 - 2026-11-08

- Daily Bulletin now retains today's and yesterday's posts, purges older posts, and uses globally unique post IDs across days. Likes and deletes work for either retained day.
- Added persistent `bulletin_post_sequence` table (additive migration; no DB reset required).
- Added per-reader recent status history, retaining the three most recent previous status texts, with an input dropdown to select one for editing.
- Added `recent_statuses_json` profile column (additive migration; no DB reset required).

## 0.1.7 - 2026-10-24

- Reading progress now shows a read-only completion percentage (pages or audio time) next to the progress in the book editor and in the scene tooltip.
- Readers can like their own status message.
- Live Book Chat: a "To" dropdown lets a reader address any message to an active reader, someone who wrote to them, or anyone in today's chat (including readers who have left). The recipient stays selected between messages, receives the bell notification, and messages addressed to you get a highlight bar.
- No schema changes.

## 0.1.6 - 2026-10-18

- Live Book Chat: messages now show a `#id`, and each has a like heart with a count (placed next to the delete icon like the Forum). Admins can delete a message by id from the server: `DELETE /api/admin/chat/messages/:id` (localhost only).
- Reading status/mood in the scene now has a like heart and count; the count resets when the status text changes.
- Added `like_count` on `chat_messages` and `status_like_count` on `profiles` (additive schema changes, no DB reset required).
- Documented the Forum and Live Chat APIs in `docs/api.md`.

## 0.1.5 - 2026-10-11

- Added a Live Book Chat box (between Profile and Bulletin) with daily reset, one image per message, newest-first order, and author-only delete. A Chat button in another reader's expanded profile addresses the first message to them (sender -> recipient line with icons and the book), and the recipient gets a bell badge on their icon until they open or answer the chat. Observers do not see the chat.
- Added `chat_messages` and `chat_pings` tables (additive schema change, no DB reset required).
- Fixed a ghost reader staying greyed out with a restarting timer after updating status; any update from a ghost now reactivates them.
- Fixed ghost/idle time being counted as reading time in the statistics box and top-readers ranking.
- Bulletin Delete is now a trash icon with spacing from Like and a confirmation prompt.

## 0.1.4 - 2026-09-26

- Added a "ghost reading" presence state: when a reader leaves (Leave button, tab close, or 60 minutes of inactivity), they linger in the scene for up to 1 hour with a darkened icon/status badge and no reading-time or book-format badge, then are fully removed if they don't return.
- Reading minutes now accrue based on each reader's actual elapsed session time when they enter ghost mode, replacing the previous flat 60-minute assumption.
- Added `is_ghost` and `ghost_started_at` profile columns (additive schema change, no DB reset required).

## 0.1.3 - 2026-09-23

- Added a personal "Day streak" 🔥 stat to the statistics box, tracking consecutive daily logins per reader.
- Added `reader_streaks` table (additive schema change, no DB reset required).

## 0.1.2 - 2026-09-22

- Added a "Daily top readers" leaderboard (gold/silver/bronze) to the statistics box, tracking per-reader reading minutes for the day.
- Added `daily_reader_minutes` table (additive schema change, no DB reset required).

## 0.1.1 - 2026-09-12

- Fixed reading-status updates so the scene reflects a newly entered status after one update action.
- Documented local testing and manual cloud deployment steps.

## 0.1.0

- Initial Virtual Reading World release.
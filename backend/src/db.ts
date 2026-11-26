import path from 'path';
import { mkdirSync } from 'fs';
import sqlite3 from 'sqlite3';

const DEFAULT_ACTIVE_READER_LIMIT = 10;
const POSITION_SCALE = 10000;
const INACTIVITY_WINDOW_MS = 60 * 60 * 1000;
const GHOST_WINDOW_MS = 60 * 60 * 1000;
const BULLETIN_TEXT_MAX_LENGTH = 800;
const BULLETIN_TIME_ZONE = 'America/New_York';
const PROFILE_BOOK_SLOT_COUNT = 4;
const BETWEEN_BOOKS_INDEX = 4;
const BETWEEN_BOOKS_TITLE = 'Between books';

const bulletinDayKeyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BULLETIN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function toStoredPosition(value: number): number {
  return Math.round(clamp01(value) * POSITION_SCALE);
}

function fromStoredPosition(value: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  if (parsed >= 0 && parsed <= 1) {
    return clamp01(parsed);
  }
  return clamp01(parsed / POSITION_SCALE);
}

function normalizeStatus(status: string | null | undefined): string {
  return typeof status === 'string' && status.trim() ? status : 'Reading';
}

function normalizeRecentStatuses(value: unknown): string[] {
  let entries: unknown[] = [];
  if (Array.isArray(value)) {
    entries = value;
  } else if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        entries = parsed;
      }
    } catch {
      return [];
    }
  }

  const statuses: string[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'string') {
      continue;
    }
    const status = entry.trim().slice(0, 48);
    if (status && !statuses.includes(status)) {
      statuses.push(status);
    }
    if (statuses.length === 3) {
      break;
    }
  }
  return statuses;
}

function normalizeBackgroundScene(value: unknown): string {
  if (value === 'sunrise' || value === 'lush-forest' || value === 'mountain-range' || value === 'ocean-beach' || value === 'lake' || value === 'library' || value === 'rain') {
    return String(value);
  }
  return 'ocean-beach';
}

function normalizeProgressMode(value: unknown): 'pages' | 'audio' {
  return value === 'audio' ? 'audio' : 'pages';
}

function normalizeBookFormat(value: unknown): 'physical' | 'ebook' | 'audiobook' {
  if (value === 'ebook' || value === 'audiobook') {
    return value;
  }
  return 'physical';
}

function parseFavoriteAuthors(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((author) => String(author)).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((author) => String(author)).filter(Boolean);
      }
    } catch {
      return value.split(',').map((author) => author.trim()).filter(Boolean);
    }
  }

  return [];
}

function serializeFavoriteAuthors(value: string[]): string {
  return JSON.stringify(value ?? []);
}

function isActiveFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

async function ensureSqliteColumn(columnName: string, definition: string): Promise<void> {
  if (databaseType !== 'sqlite') {
    return;
  }

  const existingColumns = await allSql<{ name?: string }>('PRAGMA table_info(profiles)');
  if (existingColumns.some((column) => column.name === columnName)) {
    return;
  }

  await runSql(`ALTER TABLE profiles ADD COLUMN ${columnName} ${definition}`);
}

function getDatabaseType(): 'sqlite' | 'postgres' {
  const configuredType = String(process.env.DB_TYPE || '').trim().toLowerCase();
  if (configuredType === 'postgres' || configuredType === 'postgresql') {
    return 'postgres';
  }
  if (configuredType === 'sqlite') {
    return 'sqlite';
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    return 'postgres';
  }
  return 'sqlite';
}

const databaseType = getDatabaseType();
const databaseFile = process.env.DATABASE_FILE
  ? path.resolve(process.cwd(), process.env.DATABASE_FILE)
  : path.join(process.cwd(), 'data', 'virtual-reading-world.sqlite');

let sqliteDb: any = null;
let pool: any = null;

function getSqliteDb(): any {
  if (!sqliteDb) {
    throw new Error('SQLite database has not been initialized');
  }
  return sqliteDb;
}

function runSql(sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    getSqliteDb().run(sql, params, function (this: any, err: Error | null) {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function getSql<T = any>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    getSqliteDb().get(sql, params, (err: Error | null, row: T | undefined) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function allSql<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    getSqliteDb().all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

function execSql(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getSqliteDb().exec(sql, (err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

if (databaseType === 'postgres') {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required when DB_TYPE=postgres');
  }
  const { Pool } = require('pg') as { Pool: new (config: { connectionString: string }) => any };
  pool = new Pool({ connectionString });
} else {
  mkdirSync(path.dirname(databaseFile), { recursive: true });
  sqliteDb = new sqlite3.Database(databaseFile);
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
}

export const dbType = databaseType;
export const dbFile = databaseFile;
export { pool };

export type Profile = {
  username: string;
  currentBook: string;
  currentAuthor: string;
  currentPage: number;
  totalPageCount: number;
  progressMode: 'pages' | 'audio';
  currentBookIndex: number;
  books: ProfileBook[];
  aboutMeBio: string;
  aboutMeLink: string;
  booksRead?: number | null;
  readingGoal?: number | null;
  favoriteAuthors: string[];
  status: string;
  recentStatuses: string[];
  positionX: number;
  positionY: number;
  avatarIcon: string;
  avatarImageData: string;
  backgroundScene: string;
  isActive: boolean;
  loginTimeUtc: number;
  isGhost: boolean;
  statusLikeCount: number;
};

export type ProfileBook = {
  title: string;
  author: string;
  imageData?: string;
  feeling?: string;
  feelingLikeCount?: number;
  currentProgress: number;
  totalProgress: number;
  currentRating: number;
  likeCount: number;
  format: 'physical' | 'ebook' | 'audiobook';
  progressMode: 'pages' | 'audio';
};

export type BulletinPost = {
  dayKey: string;
  postId: number;
  author: string;
  avatarIcon: string;
  avatarImageData: string;
  text: string;
  likeCount: number;
  createdAt: number;
  imageData: string;
};

export type DailyVisitStats = {
  dayKey: string;
  visitCount: number;
  userCount: number;
  totalReadingMinutes: number;
};

export type DailyTopReader = {
  username: string;
  minutes: number;
};

export type ChatMessage = {
  dayKey: string;
  messageId: number;
  author: string;
  avatarIcon: string;
  avatarImageData: string;
  text: string;
  imageData: string;
  createdAt: number;
  toUsername: string;
  toAvatarIcon: string;
  toAvatarImageData: string;
  bookTitle: string;
  likeCount: number;
};

export type ChatPing = {
  fromUsername: string;
  bookTitle: string;
  createdAt: number;
};

function toLocalDayKey(date = new Date()): string {
  const parts = bulletinDayKeyFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    // Fallback should never be needed, but avoids a hard failure if ICU data is unavailable.
    const fallbackYear = date.getUTCFullYear();
    const fallbackMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
    const fallbackDay = String(date.getUTCDate()).padStart(2, '0');
    return `${fallbackYear}-${fallbackMonth}-${fallbackDay}`;
  }

  return `${year}-${month}-${day}`;
}

function normalizeBulletinText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, BULLETIN_TEXT_MAX_LENGTH);
}

function normalizeAvatarIcon(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().slice(0, 8);
  }
  return '📚';
}

function normalizeAvatarImageData(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeBulletinImageData(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith('data:image/')) {
    return '';
  }
  return trimmed.slice(0, 1_500_000);
}

function normalizeDailyVisitorUsername(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase().slice(0, 60);
}

function parseDailyVisitorUsernames(value: unknown): string[] {
  let raw: unknown[] = [];

  if (Array.isArray(value)) {
    raw = value;
  } else if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        raw = parsed;
      }
    } catch {
      raw = [];
    }
  }

  const deduped = new Set<string>();
  for (const entry of raw) {
    const normalized = normalizeDailyVisitorUsername(entry);
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Array.from(deduped);
}

function serializeDailyVisitorUsernames(value: string[]): string {
  return JSON.stringify(value ?? []);
}

function normalizeVisitCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function normalizeReadingMinutes(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function calculateSessionReadingMinutes(loginTimeUtc: unknown, sessionEndUtc: number): number {
  const safeLoginTimeUtc = Number(loginTimeUtc);
  if (!Number.isFinite(safeLoginTimeUtc) || safeLoginTimeUtc <= 0) {
    return 0;
  }
  const elapsedMs = Math.max(0, sessionEndUtc - safeLoginTimeUtc);
  return Math.floor(elapsedMs / 60000);
}

// A stale session ended when the reader went idle, not when the sweep noticed.
function staleSessionEnd(lastActivityUtc: unknown, now: number): number {
  const lastActivity = Number(lastActivityUtc);
  if (!Number.isFinite(lastActivity) || lastActivity <= 0) {
    return now;
  }
  return Math.min(now, lastActivity + INACTIVITY_WINDOW_MS);
}

async function ensureDailyVisitRow(dayKey: string, now: number, postgresClient?: any): Promise<void> {
  if (databaseType === 'postgres') {
    const queryTarget = postgresClient ?? pool;
    await queryTarget.query(
      `INSERT INTO daily_visit_stats(day_key, visit_count, users_json, total_reading_minutes, updated_at)
       VALUES($1, 0, '[]', 0, $2)
       ON CONFLICT (day_key) DO NOTHING`,
      [dayKey, now]
    );
    return;
  }

  await runSql(
    `INSERT OR IGNORE INTO daily_visit_stats(day_key, visit_count, users_json, total_reading_minutes, updated_at)
     VALUES (?, 0, '[]', 0, ?)`,
    [dayKey, now]
  );
}

async function addDailyReadingMinutes(minutes: number, now: number, postgresClient?: any): Promise<void> {
  const safeMinutes = normalizeReadingMinutes(minutes);
  if (safeMinutes < 1) {
    return;
  }

  const dayKey = toLocalDayKey(new Date(now));
  await ensureDailyVisitRow(dayKey, now, postgresClient);

  if (databaseType === 'postgres') {
    const queryTarget = postgresClient ?? pool;
    await queryTarget.query(
      'UPDATE daily_visit_stats SET total_reading_minutes = total_reading_minutes + $2, updated_at = $3 WHERE day_key = $1',
      [dayKey, safeMinutes, now]
    );
    return;
  }

  await runSql(
    'UPDATE daily_visit_stats SET total_reading_minutes = total_reading_minutes + ?, updated_at = ? WHERE day_key = ?',
    [safeMinutes, now, dayKey]
  );
}

async function addDailyReaderMinutes(username: string, minutes: number, now: number, postgresClient?: any): Promise<void> {
  const safeMinutes = normalizeReadingMinutes(minutes);
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  if (safeMinutes < 1 || !normalizedUsername) {
    return;
  }

  const dayKey = toLocalDayKey(new Date(now));

  if (databaseType === 'postgres') {
    const queryTarget = postgresClient ?? pool;
    await queryTarget.query(
      `INSERT INTO daily_reader_minutes(day_key, username, minutes, updated_at)
       VALUES($1, $2, $3, $4)
       ON CONFLICT (day_key, username) DO UPDATE
       SET minutes = daily_reader_minutes.minutes + $3, updated_at = $4`,
      [dayKey, normalizedUsername, safeMinutes, now]
    );
    return;
  }

  await runSql(
    `INSERT INTO daily_reader_minutes(day_key, username, minutes, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(day_key, username) DO UPDATE SET
       minutes = minutes + excluded.minutes,
       updated_at = excluded.updated_at`,
    [dayKey, normalizedUsername, safeMinutes, now]
  );
}

async function purgeStaleDailyReaderMinutesRowsForToday(): Promise<string> {
  const today = toLocalDayKey();

  if (databaseType === 'postgres') {
    await pool.query('DELETE FROM daily_reader_minutes WHERE day_key <> $1', [today]);
    return today;
  }

  await runSql('DELETE FROM daily_reader_minutes WHERE day_key <> ?', [today]);
  return today;
}

async function expireStaleGhosts(now: number): Promise<void> {
  const ghostCutoff = now - GHOST_WINDOW_MS;

  if (databaseType === 'postgres') {
    await pool.query(
      `UPDATE profiles
       SET is_active = FALSE, is_ghost = FALSE, ghost_started_at = 0, login_time_utc = 0, updated_at = $1
       WHERE is_ghost = TRUE AND ghost_started_at > 0 AND ghost_started_at < $2`,
      [now, ghostCutoff]
    );
    return;
  }

  await runSql(
    `UPDATE profiles
     SET is_active = 0, is_ghost = 0, ghost_started_at = 0, login_time_utc = 0, updated_at = ?
     WHERE is_ghost = 1 AND ghost_started_at > 0 AND ghost_started_at < ?`,
    [now, ghostCutoff]
  );
}

async function deactivateStaleProfilesAndAccrue(now: number, cutoff: number): Promise<void> {
  await expireStaleGhosts(now);

  if (databaseType === 'postgres') {
    const staleCandidates = await pool.query(
      `SELECT username, login_time_utc, updated_at FROM profiles
       WHERE is_active = TRUE AND is_ghost = FALSE AND updated_at < $1`,
      [cutoff]
    );
    const staleEntries = staleCandidates.rows as { username: string; login_time_utc: unknown; updated_at: unknown }[];
    if (staleEntries.length > 0) {
      await pool.query(
        `UPDATE profiles
         SET is_ghost = TRUE, ghost_started_at = $1, login_time_utc = 0, updated_at = $1
         WHERE is_active = TRUE AND is_ghost = FALSE AND updated_at < $2`,
        [now, cutoff]
      );
      for (const entry of staleEntries) {
        const minutes = calculateSessionReadingMinutes(entry.login_time_utc, staleSessionEnd(entry.updated_at, now));
        if (minutes >= 1) {
          await addDailyReadingMinutes(minutes, now);
          await addDailyReaderMinutes(entry.username, minutes, now);
        }
      }
    }
    return;
  }

  const staleRows = await allSql<{ username?: string; login_time_utc?: number; updated_at?: number }>(
    'SELECT username, login_time_utc, updated_at FROM profiles WHERE is_active = 1 AND is_ghost = 0 AND updated_at < ?',
    [cutoff]
  );

  if (staleRows.length > 0) {
    await runSql(
      `UPDATE profiles
       SET is_ghost = 1, ghost_started_at = ?, login_time_utc = 0, updated_at = ?
       WHERE is_active = 1 AND is_ghost = 0 AND updated_at < ?`,
      [now, now, cutoff]
    );

    for (const row of staleRows) {
      const username = String(row.username ?? '');
      if (!username) {
        continue;
      }
      const minutes = calculateSessionReadingMinutes(row.login_time_utc, staleSessionEnd(row.updated_at, now));
      if (minutes >= 1) {
        await addDailyReadingMinutes(minutes, now);
        await addDailyReaderMinutes(username, minutes, now);
      }
    }
  }
}

export async function enterGhostMode(username: string): Promise<Profile | null> {
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  if (!normalizedUsername) {
    return null;
  }

  const now = Date.now();

  if (databaseType === 'postgres') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const currentResult = await client.query(
        'SELECT is_active, is_ghost, login_time_utc FROM profiles WHERE username = $1 FOR UPDATE',
        [normalizedUsername]
      );
      const current = currentResult.rows[0] as { is_active?: boolean; is_ghost?: boolean; login_time_utc?: unknown } | undefined;
      if (!current || !current.is_active || current.is_ghost) {
        await client.query('COMMIT');
        return current ? await getProfile(normalizedUsername) : null;
      }

      const minutes = calculateSessionReadingMinutes(current.login_time_utc, now);

      const result = await client.query(
        `UPDATE profiles
         SET is_ghost = TRUE, ghost_started_at = $2, login_time_utc = 0, updated_at = $2
         WHERE username = $1
         RETURNING username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, recent_statuses_json, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc, is_ghost, status_like_count`,
        [normalizedUsername, now]
      );

      if (minutes >= 1) {
        await addDailyReadingMinutes(minutes, now, client);
        await addDailyReaderMinutes(normalizedUsername, minutes, now, client);
      }

      await client.query('COMMIT');
      return result.rows[0] ? mapProfileRow(result.rows[0]) : null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const current = await getSql<{ is_active?: number; is_ghost?: number; login_time_utc?: number }>(
    'SELECT is_active, is_ghost, login_time_utc FROM profiles WHERE username = ?',
    [normalizedUsername]
  );
  if (!current || current.is_active !== 1 || current.is_ghost === 1) {
    return current ? await getProfile(normalizedUsername) : null;
  }

  const minutes = calculateSessionReadingMinutes(current.login_time_utc, now);

  await runSql(
    `UPDATE profiles
     SET is_ghost = 1, ghost_started_at = ?, login_time_utc = 0, updated_at = ?
     WHERE username = ?`,
    [now, now, normalizedUsername]
  );

  if (minutes >= 1) {
    await addDailyReadingMinutes(minutes, now);
    await addDailyReaderMinutes(normalizedUsername, minutes, now);
  }

  return getProfile(normalizedUsername);
}

export async function reactivateFromGhost(username: string): Promise<Profile | null> {
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  if (!normalizedUsername) {
    return null;
  }

  const now = Date.now();

  if (databaseType === 'postgres') {
    await pool.query(
      `UPDATE profiles
       SET is_active = TRUE, is_ghost = FALSE, ghost_started_at = 0, login_time_utc = $2, updated_at = $2
       WHERE username = $1`,
      [normalizedUsername, now]
    );
    return getProfile(normalizedUsername);
  }

  await runSql(
    `UPDATE profiles
     SET is_active = 1, is_ghost = 0, ghost_started_at = 0, login_time_utc = ?, updated_at = ?
     WHERE username = ?`,
    [now, now, normalizedUsername]
  );

  return getProfile(normalizedUsername);
}


async function getLiveActiveReadingMinutes(now: number): Promise<number> {
  const cutoff = now - INACTIVITY_WINDOW_MS;

  if (databaseType === 'postgres') {
    const result = await pool.query(
      `SELECT login_time_utc
       FROM profiles
       WHERE is_active = TRUE AND updated_at > $1 AND login_time_utc > 0`,
      [cutoff]
    );

    return result.rows.reduce((total: number, row: { login_time_utc?: unknown }) => {
      return total + calculateSessionReadingMinutes(row.login_time_utc, now);
    }, 0);
  }

  const rows = await allSql<{ login_time_utc?: number }>(
    `SELECT login_time_utc
     FROM profiles
     WHERE is_active = 1 AND updated_at > ? AND login_time_utc > 0`,
    [cutoff]
  );

  return rows.reduce((total, row) => total + calculateSessionReadingMinutes(row.login_time_utc, now), 0);
}

async function getLiveActiveReaderMinutes(now: number): Promise<Map<string, number>> {
  const cutoff = now - INACTIVITY_WINDOW_MS;
  const liveMinutes = new Map<string, number>();

  if (databaseType === 'postgres') {
    const result = await pool.query(
      `SELECT username, login_time_utc
       FROM profiles
       WHERE is_active = TRUE AND updated_at > $1 AND login_time_utc > 0`,
      [cutoff]
    );

    for (const row of result.rows as { username?: string; login_time_utc?: unknown }[]) {
      const username = String(row.username ?? '');
      if (!username) {
        continue;
      }
      liveMinutes.set(username, calculateSessionReadingMinutes(row.login_time_utc, now));
    }
    return liveMinutes;
  }

  const rows = await allSql<{ username?: string; login_time_utc?: number }>(
    `SELECT username, login_time_utc
     FROM profiles
     WHERE is_active = 1 AND updated_at > ? AND login_time_utc > 0`,
    [cutoff]
  );

  for (const row of rows) {
    const username = String(row.username ?? '');
    if (!username) {
      continue;
    }
    liveMinutes.set(username, calculateSessionReadingMinutes(row.login_time_utc, now));
  }
  return liveMinutes;
}

function toDailyVisitStats(dayKey: string, visitCount: unknown, usernames: string[], totalReadingMinutes: unknown): DailyVisitStats {
  return {
    dayKey,
    visitCount: normalizeVisitCount(visitCount),
    userCount: usernames.length,
    totalReadingMinutes: normalizeReadingMinutes(totalReadingMinutes),
  };
}

function mapBulletinRow(row: any): BulletinPost {
  return {
    dayKey: String(row.day_key ?? row.dayKey ?? ''),
    postId: Number(row.post_id ?? row.postId ?? 0),
    author: typeof row.author === 'string' ? row.author : '',
    avatarIcon: normalizeAvatarIcon(row.avatar_icon ?? row.avatarIcon),
    avatarImageData: normalizeAvatarImageData(row.avatar_image_data ?? row.avatarImageData),
    text: typeof row.content_text === 'string' ? row.content_text : (typeof row.text === 'string' ? row.text : ''),
    likeCount: normalizeLikeCount(row.like_count ?? row.likeCount),
    imageData: normalizeBulletinImageData(row.image_data ?? row.imageData),
    createdAt: Number(row.created_at ?? row.createdAt ?? 0),
  };
}

async function purgeStaleBulletinRowsForToday(): Promise<string> {
  const today = toLocalDayKey();
  const yesterday = previousDayKey(today);

  if (databaseType === 'postgres') {
    await pool.query('DELETE FROM bulletin_posts WHERE day_key <> $1 AND day_key <> $2', [today, yesterday]);
    return today;
  }

  await runSql('DELETE FROM bulletin_posts WHERE day_key <> ? AND day_key <> ?', [today, yesterday]);
  return today;
}

async function purgeStaleDailyVisitRowsForToday(): Promise<string> {
  const today = toLocalDayKey();

  if (databaseType === 'postgres') {
    await pool.query('DELETE FROM daily_visit_stats WHERE day_key <> $1', [today]);
    return today;
  }

  await runSql('DELETE FROM daily_visit_stats WHERE day_key <> ?', [today]);
  return today;
}

function normalizeLikeCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function normalizeRating(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  const clamped = Math.min(5, Math.max(0, parsed));
  return Math.round(clamped * 2) / 2;
}

function createDefaultBook(index: number): ProfileBook {
  if (index === 0) {
    return {
      title: '',
      author: '',
      currentProgress: 1,
      totalProgress: 0,
      currentRating: 0,
      likeCount: 0,
      format: 'physical',
      progressMode: 'pages',
    };
  }

  return {
    title: '',
    author: '',
    currentProgress: 0,
    totalProgress: 0,
    currentRating: 0,
    likeCount: 0,
    format: 'physical',
    progressMode: 'pages',
  };
}

function clampBookIndex(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(BETWEEN_BOOKS_INDEX, Math.max(0, Math.floor(parsed)));
}

function normalizeBookEntry(value: unknown, fallback: ProfileBook): ProfileBook {
  const source = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const format = normalizeBookFormat(source.format ?? fallback.format);
  const normalizedMode = format === 'audiobook' ? 'audio' : 'pages';
  const safeCurrent = Number(source.currentProgress ?? fallback.currentProgress ?? 0);
  const safeTotal = Number(source.totalProgress ?? fallback.totalProgress ?? 0);
  const safeRating = normalizeRating(source.currentRating ?? fallback.currentRating ?? 0);
  const safeLikeCount = normalizeLikeCount(source.likeCount ?? fallback.likeCount ?? 0);

  return {
    title: typeof source.title === 'string' ? source.title : fallback.title,
    author: typeof source.author === 'string' ? source.author : fallback.author,
    imageData: normalizeBulletinImageData(source.imageData ?? fallback.imageData),
    feeling: typeof source.feeling === 'string' ? source.feeling.replace(/[\r\n]+/g, ' ').slice(0, 160) : '',
    feelingLikeCount: normalizeLikeCount(source.feelingLikeCount ?? fallback.feelingLikeCount ?? 0),
    currentProgress: Number.isFinite(safeCurrent) && safeCurrent >= 0 ? Math.floor(safeCurrent) : 0,
    totalProgress: Number.isFinite(safeTotal) && safeTotal >= 0 ? Math.floor(safeTotal) : 0,
    currentRating: safeRating,
    likeCount: safeLikeCount,
    format,
    progressMode: normalizedMode,
  };
}

function parseBooksData(value: unknown, singleBookFallback: ProfileBook): ProfileBook[] {
  let rawBooks: unknown[] = [];

  if (Array.isArray(value)) {
    rawBooks = value;
  } else if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        rawBooks = parsed;
      } else if (typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.books)) {
        rawBooks = parsed.books;
      }
    } catch {
      rawBooks = [];
    }
  }

  const books: ProfileBook[] = [];
  for (let index = 0; index < PROFILE_BOOK_SLOT_COUNT; index += 1) {
    const fallback = index === 0 ? singleBookFallback : createDefaultBook(index);
    const rawBook = rawBooks[index] as Record<string, unknown> | undefined;
    const isLegacyBetweenBooksSlot = index === PROFILE_BOOK_SLOT_COUNT - 1
      && typeof rawBook?.title === 'string'
      && rawBook.title.trim().toLowerCase() === BETWEEN_BOOKS_TITLE.toLowerCase();
    books.push(normalizeBookEntry(isLegacyBetweenBooksSlot ? undefined : rawBook, fallback));
  }

  return books;
}

function normalizeReadingCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function parseAboutMeData(value: unknown): { aboutMeBio: string; aboutMeLink: string; booksRead: number | null; readingGoal: number | null } {
  let parsed = value;
  if (typeof value === 'string' && value.trim()) {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { aboutMeBio: '', aboutMeLink: '', booksRead: null, readingGoal: null };
  }
  const source = parsed as Record<string, unknown>;
  return {
    aboutMeBio: typeof source.aboutMeBio === 'string' ? source.aboutMeBio.slice(0, 280) : '',
    aboutMeLink: typeof source.aboutMeLink === 'string' ? source.aboutMeLink.slice(0, 500) : '',
    booksRead: normalizeReadingCount(source.booksRead),
    readingGoal: normalizeReadingCount(source.readingGoal),
  };
}

function serializeBooksData(books: ProfileBook[], aboutMeBio = '', aboutMeLink = '', booksRead?: number | null, readingGoal?: number | null): string {
  return JSON.stringify({
    books,
    aboutMeBio: typeof aboutMeBio === 'string' ? aboutMeBio.trim().slice(0, 280) : '',
    aboutMeLink: typeof aboutMeLink === 'string' ? aboutMeLink.trim().slice(0, 500) : '',
    booksRead: normalizeReadingCount(booksRead),
    readingGoal: normalizeReadingCount(readingGoal),
  });
}

function mapProfileRow(row: any): Profile {
  const singleBookFallback: ProfileBook = {
    title: row.current_book ?? row.currentBook ?? '',
    author: row.current_author ?? row.currentAuthor ?? '',
    currentProgress: Number(row.current_page ?? row.currentPage ?? 0),
    totalProgress: Number(row.total_page_count ?? row.totalPageCount ?? 0),
    currentRating: 0,
    likeCount: 0,
    format: normalizeProgressMode(row.progress_mode ?? row.progressMode) === 'audio' ? 'audiobook' : 'physical',
    progressMode: normalizeProgressMode(row.progress_mode ?? row.progressMode),
  };
  const books = parseBooksData(row.books_data ?? row.booksData, singleBookFallback);
  const aboutMe = parseAboutMeData(row.books_data ?? row.booksData);
  const storedBookIndex = clampBookIndex(row.current_book_index ?? row.currentBookIndex ?? 0);
  const currentBookIndex = storedBookIndex === PROFILE_BOOK_SLOT_COUNT - 1
    && typeof (row.current_book ?? row.currentBook) === 'string'
    && String(row.current_book ?? row.currentBook).trim().toLowerCase() === BETWEEN_BOOKS_TITLE.toLowerCase()
    ? BETWEEN_BOOKS_INDEX
    : storedBookIndex;
  const selectedBook = currentBookIndex === BETWEEN_BOOKS_INDEX
    ? { ...createDefaultBook(0), title: BETWEEN_BOOKS_TITLE }
    : books[currentBookIndex] ?? books[0] ?? createDefaultBook(0);

  return {
    username: row.username,
    currentBook: selectedBook.title,
    currentAuthor: selectedBook.author,
    currentPage: selectedBook.currentProgress,
    totalPageCount: selectedBook.totalProgress,
    progressMode: selectedBook.progressMode,
    currentBookIndex,
    books,
    ...aboutMe,
    favoriteAuthors: parseFavoriteAuthors(row.favorite_authors ?? row.favoriteAuthors),
    status: normalizeStatus(row.status),
    recentStatuses: normalizeRecentStatuses(row.recent_statuses_json ?? row.recentStatuses),
    positionX: fromStoredPosition(Number(row.position_x ?? row.positionX ?? 50)),
    positionY: fromStoredPosition(Number(row.position_y ?? row.positionY ?? 50)),
    avatarIcon: row.avatar_icon || row.avatarIcon || '📚',
    avatarImageData: typeof row.avatar_image_data === 'string' ? row.avatar_image_data : (typeof row.avatarImageData === 'string' ? row.avatarImageData : ''),
    backgroundScene: normalizeBackgroundScene(row.background_scene ?? row.backgroundScene),
    isActive: isActiveFlag(row.is_active ?? row.isActive),
    loginTimeUtc: Number(row.login_time_utc ?? row.loginTimeUtc ?? 0),
    isGhost: isActiveFlag(row.is_ghost ?? row.isGhost),
    statusLikeCount: normalizeLikeCount(row.status_like_count ?? row.statusLikeCount),
  };
}

export async function ensureSchema() {
  if (databaseType === 'postgres') {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        username TEXT PRIMARY KEY,
        current_book TEXT NOT NULL,
        current_author TEXT NOT NULL,
        current_page INTEGER NOT NULL,
        total_page_count INTEGER NOT NULL DEFAULT 0,
        progress_mode TEXT NOT NULL DEFAULT 'pages',
        books_data TEXT NOT NULL DEFAULT '[]',
        current_book_index INTEGER NOT NULL DEFAULT 0,
        favorite_authors TEXT NOT NULL,
        status TEXT NOT NULL,
        recent_statuses_json TEXT NOT NULL DEFAULT '[]',
        position_x INTEGER NOT NULL DEFAULT 50,
        position_y INTEGER NOT NULL DEFAULT 50,
        avatar_icon TEXT NOT NULL DEFAULT '📚',
        avatar_image_data TEXT NOT NULL DEFAULT '',
        background_scene TEXT NOT NULL DEFAULT 'ocean-beach',
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        login_time_utc BIGINT NOT NULL DEFAULT 0,
        is_ghost BOOLEAN NOT NULL DEFAULT FALSE,
        ghost_started_at BIGINT NOT NULL DEFAULT 0,
        updated_at BIGINT NOT NULL DEFAULT 0
      );
    `);

    await pool.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS books_data TEXT NOT NULL DEFAULT '[]'
    `);

    await pool.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS current_book_index INTEGER NOT NULL DEFAULT 0
    `);

    await pool.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS login_time_utc BIGINT NOT NULL DEFAULT 0
    `);

    await pool.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS avatar_image_data TEXT NOT NULL DEFAULT ''
    `);

    await pool.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS is_ghost BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await pool.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS ghost_started_at BIGINT NOT NULL DEFAULT 0
    `);

    await pool.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS status_like_count INTEGER NOT NULL DEFAULT 0
    `);

    await pool.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS recent_statuses_json TEXT NOT NULL DEFAULT '[]'
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bulletin_posts (
        day_key TEXT NOT NULL,
        post_id INTEGER NOT NULL,
        author TEXT NOT NULL,
        avatar_icon TEXT NOT NULL DEFAULT '📚',
        avatar_image_data TEXT NOT NULL DEFAULT '',
        content_text TEXT NOT NULL,
        image_data TEXT NOT NULL DEFAULT '',
        like_count INTEGER NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL,
        PRIMARY KEY (day_key, post_id)
      );
    `);

    await pool.query(`
      ALTER TABLE bulletin_posts
      ADD COLUMN IF NOT EXISTS image_data TEXT NOT NULL DEFAULT ''
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bulletin_post_sequence (
        sequence_id INTEGER PRIMARY KEY,
        next_id BIGINT NOT NULL
      );
    `);
    await pool.query(
      `INSERT INTO bulletin_post_sequence(sequence_id, next_id)
       VALUES(1, (SELECT COALESCE(MAX(post_id), 0) + 1 FROM bulletin_posts))
       ON CONFLICT (sequence_id) DO NOTHING`
    );
    await pool.query(
      `UPDATE bulletin_post_sequence
       SET next_id = GREATEST(next_id, (SELECT COALESCE(MAX(post_id), 0) + 1 FROM bulletin_posts))
       WHERE sequence_id = 1`
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_visit_stats (
        day_key TEXT PRIMARY KEY,
        visit_count INTEGER NOT NULL DEFAULT 0,
        users_json TEXT NOT NULL DEFAULT '[]',
        total_reading_minutes INTEGER NOT NULL DEFAULT 0,
        updated_at BIGINT NOT NULL DEFAULT 0
      );
    `);

    await pool.query(`
      ALTER TABLE daily_visit_stats
      ADD COLUMN IF NOT EXISTS total_reading_minutes INTEGER NOT NULL DEFAULT 0
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_reader_minutes (
        day_key TEXT NOT NULL,
        username TEXT NOT NULL,
        minutes INTEGER NOT NULL DEFAULT 0,
        updated_at BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (day_key, username)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reader_streaks (
        username TEXT PRIMARY KEY,
        day_streak INTEGER NOT NULL DEFAULT 0,
        last_login_day_key TEXT NOT NULL DEFAULT '',
        updated_at BIGINT NOT NULL DEFAULT 0
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        day_key TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        author TEXT NOT NULL,
        avatar_icon TEXT NOT NULL DEFAULT '📚',
        avatar_image_data TEXT NOT NULL DEFAULT '',
        content_text TEXT NOT NULL DEFAULT '',
        image_data TEXT NOT NULL DEFAULT '',
        to_username TEXT NOT NULL DEFAULT '',
        to_avatar_icon TEXT NOT NULL DEFAULT '',
        to_avatar_image_data TEXT NOT NULL DEFAULT '',
        book_title TEXT NOT NULL DEFAULT '',
        created_at BIGINT NOT NULL,
        PRIMARY KEY (day_key, message_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_pings (
        day_key TEXT NOT NULL,
        target_username TEXT NOT NULL,
        from_username TEXT NOT NULL,
        book_title TEXT NOT NULL DEFAULT '',
        created_at BIGINT NOT NULL,
        PRIMARY KEY (day_key, target_username, from_username)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_message_sequence (
        sequence_id INTEGER PRIMARY KEY,
        next_id BIGINT NOT NULL
      );
    `);
    await pool.query(
      `INSERT INTO chat_message_sequence(sequence_id, next_id)
       VALUES(1, (SELECT COALESCE(MAX(message_id), 0) + 1 FROM chat_messages))
       ON CONFLICT (sequence_id) DO NOTHING`
    );
    await pool.query(
      `UPDATE chat_message_sequence
       SET next_id = GREATEST(next_id, (SELECT COALESCE(MAX(message_id), 0) + 1 FROM chat_messages))
       WHERE sequence_id = 1`
    );

    for (const column of ['to_username', 'to_avatar_icon', 'to_avatar_image_data', 'book_title']) {
      await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS ${column} TEXT NOT NULL DEFAULT ''`);
    }
    await pool.query('ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0');

    await pool.query(`
      UPDATE profiles
      SET status = 'Reading'
      WHERE status IS NULL OR status = '' OR LOWER(status) = 'reading'
    `);

    await pool.query(`
      INSERT INTO app_settings(key, value)
      VALUES ('active_reader_limit', $1)
      ON CONFLICT (key) DO NOTHING
    `, [String(DEFAULT_ACTIVE_READER_LIMIT)]);
    return;
  }

  await execSql(`
    CREATE TABLE IF NOT EXISTS profiles (
      username TEXT PRIMARY KEY,
      current_book TEXT NOT NULL,
      current_author TEXT NOT NULL,
      current_page INTEGER NOT NULL,
      total_page_count INTEGER NOT NULL DEFAULT 0,
      progress_mode TEXT NOT NULL DEFAULT 'pages',
      books_data TEXT NOT NULL DEFAULT '[]',
      current_book_index INTEGER NOT NULL DEFAULT 0,
      favorite_authors TEXT NOT NULL,
      status TEXT NOT NULL,
      recent_statuses_json TEXT NOT NULL DEFAULT '[]',
      position_x INTEGER NOT NULL DEFAULT 50,
      position_y INTEGER NOT NULL DEFAULT 50,
      avatar_icon TEXT NOT NULL DEFAULT '📚',
      avatar_image_data TEXT NOT NULL DEFAULT '',
      background_scene TEXT NOT NULL DEFAULT 'ocean-beach',
      is_active INTEGER NOT NULL DEFAULT 0,
      login_time_utc INTEGER NOT NULL DEFAULT 0,
      is_ghost INTEGER NOT NULL DEFAULT 0,
      ghost_started_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  await ensureSqliteColumn('total_page_count', 'INTEGER NOT NULL DEFAULT 0');
  await ensureSqliteColumn('progress_mode', "TEXT NOT NULL DEFAULT 'pages'");
  await ensureSqliteColumn('books_data', "TEXT NOT NULL DEFAULT '[]'");
  await ensureSqliteColumn('current_book_index', 'INTEGER NOT NULL DEFAULT 0');
  await ensureSqliteColumn('background_scene', "TEXT NOT NULL DEFAULT 'ocean-beach'");
  await ensureSqliteColumn('login_time_utc', 'INTEGER NOT NULL DEFAULT 0');
  await ensureSqliteColumn('avatar_image_data', "TEXT NOT NULL DEFAULT ''");
  await ensureSqliteColumn('is_ghost', 'INTEGER NOT NULL DEFAULT 0');
  await ensureSqliteColumn('ghost_started_at', 'INTEGER NOT NULL DEFAULT 0');
  await ensureSqliteColumn('status_like_count', 'INTEGER NOT NULL DEFAULT 0');
  await ensureSqliteColumn('recent_statuses_json', "TEXT NOT NULL DEFAULT '[]'");

  await execSql(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await execSql(`
    CREATE TABLE IF NOT EXISTS bulletin_posts (
      day_key TEXT NOT NULL,
      post_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      avatar_icon TEXT NOT NULL DEFAULT '📚',
      avatar_image_data TEXT NOT NULL DEFAULT '',
      content_text TEXT NOT NULL,
      image_data TEXT NOT NULL DEFAULT '',
      like_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (day_key, post_id)
    );
  `);

  const bulletinColumns = await allSql<{ name?: string }>('PRAGMA table_info(bulletin_posts)');
  if (!bulletinColumns.some((column) => column.name === 'image_data')) {
    await runSql("ALTER TABLE bulletin_posts ADD COLUMN image_data TEXT NOT NULL DEFAULT ''");
  }

  await execSql(`
    CREATE TABLE IF NOT EXISTS bulletin_post_sequence (
      sequence_id INTEGER PRIMARY KEY,
      next_id INTEGER NOT NULL
    );
  `);
  await runSql(
    `INSERT OR IGNORE INTO bulletin_post_sequence(sequence_id, next_id)
     SELECT 1, COALESCE(MAX(post_id), 0) + 1 FROM bulletin_posts`
  );
  await runSql(
    `UPDATE bulletin_post_sequence
     SET next_id = MAX(next_id, (SELECT COALESCE(MAX(post_id), 0) + 1 FROM bulletin_posts))
     WHERE sequence_id = 1`
  );

  await execSql(`
    CREATE TABLE IF NOT EXISTS daily_visit_stats (
      day_key TEXT PRIMARY KEY,
      visit_count INTEGER NOT NULL DEFAULT 0,
      users_json TEXT NOT NULL DEFAULT '[]',
      total_reading_minutes INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  const dailyVisitColumns = await allSql<{ name?: string }>('PRAGMA table_info(daily_visit_stats)');
  if (!dailyVisitColumns.some((column) => column.name === 'total_reading_minutes')) {
    await runSql('ALTER TABLE daily_visit_stats ADD COLUMN total_reading_minutes INTEGER NOT NULL DEFAULT 0');
  }

    await execSql(`
    CREATE TABLE IF NOT EXISTS daily_reader_minutes (
      day_key TEXT NOT NULL,
      username TEXT NOT NULL,
      minutes INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day_key, username)
    );
  `);

  await execSql(`
    CREATE TABLE IF NOT EXISTS reader_streaks (
      username TEXT PRIMARY KEY,
      day_streak INTEGER NOT NULL DEFAULT 0,
      last_login_day_key TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  await execSql(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      day_key TEXT NOT NULL,
      message_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      avatar_icon TEXT NOT NULL DEFAULT '📚',
      avatar_image_data TEXT NOT NULL DEFAULT '',
      content_text TEXT NOT NULL DEFAULT '',
      image_data TEXT NOT NULL DEFAULT '',
      to_username TEXT NOT NULL DEFAULT '',
      to_avatar_icon TEXT NOT NULL DEFAULT '',
      to_avatar_image_data TEXT NOT NULL DEFAULT '',
      book_title TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (day_key, message_id)
    );
  `);

  await execSql(`
    CREATE TABLE IF NOT EXISTS chat_pings (
      day_key TEXT NOT NULL,
      target_username TEXT NOT NULL,
      from_username TEXT NOT NULL,
      book_title TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (day_key, target_username, from_username)
    );
  `);

  await execSql(`
    CREATE TABLE IF NOT EXISTS chat_message_sequence (
      sequence_id INTEGER PRIMARY KEY,
      next_id INTEGER NOT NULL
    );
  `);
  await runSql(
    `INSERT OR IGNORE INTO chat_message_sequence(sequence_id, next_id)
     SELECT 1, COALESCE(MAX(message_id), 0) + 1 FROM chat_messages`
  );
  await runSql(
    `UPDATE chat_message_sequence
     SET next_id = MAX(next_id, (SELECT COALESCE(MAX(message_id), 0) + 1 FROM chat_messages))
     WHERE sequence_id = 1`
  );

  const chatColumns = await allSql<{ name?: string }>('PRAGMA table_info(chat_messages)');
  for (const column of ['to_username', 'to_avatar_icon', 'to_avatar_image_data', 'book_title']) {
    if (!chatColumns.some((existing) => existing.name === column)) {
      await runSql(`ALTER TABLE chat_messages ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
    }
  }
  if (!chatColumns.some((existing) => existing.name === 'like_count')) {
    await runSql('ALTER TABLE chat_messages ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0');
  }

  await execSql(`
    UPDATE profiles
    SET status = 'Reading'
    WHERE status IS NULL OR status = '' OR LOWER(status) = 'reading'
  `);

  await runSql(`
    INSERT OR IGNORE INTO app_settings(key, value)
    VALUES (?, ?)
  `, ['active_reader_limit', String(DEFAULT_ACTIVE_READER_LIMIT)]);
}

export async function getActiveReaderLimit(): Promise<number> {
  if (databaseType === 'postgres') {
    const result = await pool.query('SELECT value FROM app_settings WHERE key = $1', ['active_reader_limit']);
    const value = result.rows[0]?.value;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return DEFAULT_ACTIVE_READER_LIMIT;
    }
    return parsed;
  }

  const row = await getSql<{ value?: string }>('SELECT value FROM app_settings WHERE key = ?', ['active_reader_limit']);
  const parsed = Number(row?.value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_ACTIVE_READER_LIMIT;
  }
  return parsed;
}

export async function getActiveProfileCount(): Promise<number> {
  const now = Date.now();
  const cutoff = now - INACTIVITY_WINDOW_MS;
  await deactivateStaleProfilesAndAccrue(now, cutoff);

  if (databaseType === 'postgres') {
    const result = await pool.query(`
      SELECT COUNT(*)::int AS active_count
      FROM profiles
      WHERE is_active = TRUE AND updated_at > $1
    `, [cutoff]);

    return Number(result.rows[0]?.active_count ?? 0);
  }

  const row = await getSql<{ active_count?: number }>(`
    SELECT COUNT(*) AS active_count
    FROM profiles
    WHERE is_active = 1 AND updated_at > ?
  `, [cutoff]);

  return Number(row?.active_count ?? 0);
}

export async function setActiveReaderLimit(limit: number): Promise<number> {
  const safeLimit = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : DEFAULT_ACTIVE_READER_LIMIT;

  if (databaseType === 'postgres') {
    await pool.query(
      'INSERT INTO app_settings(key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      ['active_reader_limit', String(safeLimit)]
    );
    return safeLimit;
  }

  await runSql('INSERT OR REPLACE INTO app_settings(key, value) VALUES (?, ?)', ['active_reader_limit', String(safeLimit)]);
  return safeLimit;
}

export async function getProfile(username: string): Promise<Profile | null> {
  const now = Date.now();
  const cutoff = now - INACTIVITY_WINDOW_MS;

  await deactivateStaleProfilesAndAccrue(now, cutoff);

  if (databaseType === 'postgres') {
    const result = await pool.query(
      'SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, recent_statuses_json, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc, is_ghost, status_like_count FROM profiles WHERE username = $1',
      [username]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapProfileRow(result.rows[0]);
  }

  const row = await getSql<any>(`
    SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, recent_statuses_json, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc, is_ghost, status_like_count
    FROM profiles
    WHERE username = ?
  `, [username]);

  if (!row) {
    return null;
  }

  return mapProfileRow(row);
}

export async function setProfileStatusLike(username: string, status: string, delta: 1 | -1): Promise<{ status: string; statusLikeCount: number; applied: boolean } | null> {
  const name = typeof username === 'string' ? username.trim() : '';
  if (!name) {
    return null;
  }

  // The status in the request guards against liking text the reader has just replaced.
  if (databaseType === 'postgres') {
    const updated = await pool.query(
      `UPDATE profiles SET status_like_count = GREATEST(0, status_like_count + $3)
       WHERE username = $1 AND status = $2
       RETURNING status, status_like_count`,
      [name, status, delta]
    );
    if (Number(updated.rowCount ?? 0) > 0) {
      return { status: String(updated.rows[0].status ?? ''), statusLikeCount: normalizeLikeCount(updated.rows[0].status_like_count), applied: true };
    }
    const current = await pool.query('SELECT status, status_like_count FROM profiles WHERE username = $1', [name]);
    if (Number(current.rowCount ?? 0) === 0) {
      return null;
    }
    return { status: String(current.rows[0].status ?? ''), statusLikeCount: normalizeLikeCount(current.rows[0].status_like_count), applied: false };
  }

  const current = await getSql<{ status?: string; status_like_count?: number }>('SELECT status, status_like_count FROM profiles WHERE username = ?', [name]);
  if (!current) {
    return null;
  }
  if (current.status !== status) {
    return { status: String(current.status ?? ''), statusLikeCount: normalizeLikeCount(current.status_like_count), applied: false };
  }

  await runSql('UPDATE profiles SET status_like_count = MAX(0, status_like_count + ?) WHERE username = ?', [delta, name]);
  const next = await getSql<{ status_like_count?: number }>('SELECT status_like_count FROM profiles WHERE username = ?', [name]);
  return { status: String(current.status ?? ''), statusLikeCount: normalizeLikeCount(next?.status_like_count), applied: true };
}

export async function listProfiles(): Promise<Profile[]> {
  const now = Date.now();
  const cutoff = now - INACTIVITY_WINDOW_MS;
  const limit = await getActiveReaderLimit();

  await deactivateStaleProfilesAndAccrue(now, cutoff);

  if (databaseType === 'postgres') {
    const result = await pool.query(
      'SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, recent_statuses_json, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc, is_ghost, status_like_count FROM profiles WHERE is_active = TRUE AND updated_at > $1 ORDER BY updated_at DESC, username ASC LIMIT $2',
      [cutoff, limit]
    );

    return result.rows.map(mapProfileRow);
  }

  const rows = await allSql<any>(`
    SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, recent_statuses_json, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc, is_ghost, status_like_count
    FROM profiles
    WHERE is_active = 1 AND updated_at > ?
    ORDER BY updated_at DESC, username ASC
    LIMIT ?
  `, [cutoff, limit]);

  return rows.map(mapProfileRow);
}

export async function listAllProfiles(): Promise<Profile[]> {
  if (databaseType === 'postgres') {
    const result = await pool.query(
      'SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, recent_statuses_json, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc, is_ghost, status_like_count FROM profiles ORDER BY updated_at DESC, username ASC'
    );
    return result.rows.map(mapProfileRow);
  }

  const rows = await allSql<any>(`
    SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, recent_statuses_json, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc, is_ghost, status_like_count
    FROM profiles
    ORDER BY updated_at DESC, username ASC
  `);

  return rows.map(mapProfileRow);
}

export async function createProfile(username: string): Promise<Profile> {
  const books = [createDefaultBook(0), createDefaultBook(1), createDefaultBook(2), createDefaultBook(3)];
  const currentBookIndex = 0;
  const selectedBook = books[currentBookIndex];

  const defaultProfile: Profile = {
    username,
    currentBook: selectedBook.title,
    currentAuthor: selectedBook.author,
    currentPage: selectedBook.currentProgress,
    totalPageCount: selectedBook.totalProgress,
    progressMode: selectedBook.progressMode,
    currentBookIndex,
    books,
    favoriteAuthors: [],
    status: 'Reading',
    aboutMeBio: '',
    aboutMeLink: '',
    positionX: 0.5,
    positionY: 0.5,
    avatarIcon: '📚',
    avatarImageData: '',
    backgroundScene: 'ocean-beach',
    isActive: false,
    loginTimeUtc: 0,
    isGhost: false,
    statusLikeCount: 0,
    recentStatuses: [],
  };

  if (databaseType === 'postgres') {
    await pool.query(
      'INSERT INTO profiles(username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc, updated_at) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) ON CONFLICT (username) DO NOTHING',
      [defaultProfile.username, defaultProfile.currentBook, defaultProfile.currentAuthor, defaultProfile.currentPage, defaultProfile.totalPageCount, defaultProfile.progressMode, serializeBooksData(defaultProfile.books, defaultProfile.aboutMeBio, defaultProfile.aboutMeLink), defaultProfile.currentBookIndex, serializeFavoriteAuthors(defaultProfile.favoriteAuthors), defaultProfile.status, toStoredPosition(defaultProfile.positionX), toStoredPosition(defaultProfile.positionY), defaultProfile.avatarIcon, defaultProfile.avatarImageData, defaultProfile.backgroundScene, defaultProfile.isActive, defaultProfile.loginTimeUtc, Date.now()]
    );
    return defaultProfile;
  }

  await runSql(`
    INSERT OR IGNORE INTO profiles(username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    defaultProfile.username,
    defaultProfile.currentBook,
    defaultProfile.currentAuthor,
    defaultProfile.currentPage,
    defaultProfile.totalPageCount,
    defaultProfile.progressMode,
    serializeBooksData(defaultProfile.books, defaultProfile.aboutMeBio, defaultProfile.aboutMeLink),
    defaultProfile.currentBookIndex,
    serializeFavoriteAuthors(defaultProfile.favoriteAuthors),
    defaultProfile.status,
    toStoredPosition(defaultProfile.positionX),
    toStoredPosition(defaultProfile.positionY),
    defaultProfile.avatarIcon,
    defaultProfile.avatarImageData,
    defaultProfile.backgroundScene,
    defaultProfile.isActive ? 1 : 0,
    defaultProfile.loginTimeUtc,
    Date.now(),
  ]);

  return defaultProfile;
}

export async function updateProfile(profile: Profile, enforceActiveLimit = false): Promise<Profile> {
  const safeStatus = normalizeStatus(profile.status);
  const safeCurrentBookIndex = clampBookIndex(profile.currentBookIndex ?? 0);
  const safeLoginTimeUtc = Number.isFinite(Number(profile.loginTimeUtc)) ? Math.max(0, Number(profile.loginTimeUtc)) : 0;
  const persistedLoginTimeUtc = profile.isActive ? safeLoginTimeUtc : 0;
  const safeAvatarImageData = typeof profile.avatarImageData === 'string' ? profile.avatarImageData : '';
  const legacySelectedBook: ProfileBook = {
    title: profile.currentBook,
    author: profile.currentAuthor,
    currentProgress: Number(profile.currentPage ?? 0),
    totalProgress: Number(profile.totalPageCount ?? 0),
    currentRating: 0,
    likeCount: 0,
    format: normalizeProgressMode(profile.progressMode) === 'audio' ? 'audiobook' : 'physical',
    progressMode: normalizeProgressMode(profile.progressMode),
  };
  const safeBooks = parseBooksData(profile.books, legacySelectedBook);
  const isBetweenBooks = safeCurrentBookIndex === BETWEEN_BOOKS_INDEX;
  const safeSelectedBook = normalizeBookEntry({
    ...(isBetweenBooks ? legacySelectedBook : safeBooks[safeCurrentBookIndex]),
    title: isBetweenBooks ? BETWEEN_BOOKS_TITLE : profile.currentBook,
    author: isBetweenBooks ? '' : profile.currentAuthor,
    currentProgress: isBetweenBooks ? 0 : profile.currentPage,
    totalProgress: isBetweenBooks ? 0 : profile.totalPageCount,
    progressMode: isBetweenBooks ? 'pages' : profile.progressMode,
  }, isBetweenBooks ? legacySelectedBook : safeBooks[safeCurrentBookIndex] ?? legacySelectedBook);
  if (!isBetweenBooks) {
    safeBooks[safeCurrentBookIndex] = safeSelectedBook;
  }

  const now = Date.now();
  const cutoff = now - INACTIVITY_WINDOW_MS;

  if (databaseType === 'postgres') {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const currentStateResult = await client.query(
        'SELECT is_active, login_time_utc, status, recent_statuses_json FROM profiles WHERE username = $1 FOR UPDATE',
        [profile.username]
      );
      const wasActive = currentStateResult.rows[0]?.is_active === true;
      const previousLoginTimeUtc = Number(currentStateResult.rows[0]?.login_time_utc ?? 0);
      const currentStatus = String(currentStateResult.rows[0]?.status ?? '');
      const recentStatuses = normalizeRecentStatuses(currentStateResult.rows[0]?.recent_statuses_json);
      const previousStatus = currentStatus.trim();
      const nextRecentStatuses = normalizeRecentStatuses([
        ...(previousStatus && previousStatus !== 'Reading' && previousStatus !== safeStatus.trim() ? [previousStatus] : []),
        ...recentStatuses,
      ].filter((entry) => entry !== safeStatus.trim()));

      if (enforceActiveLimit && profile.isActive) {
        const staleCandidates = await client.query(
          `SELECT username, login_time_utc, updated_at FROM profiles
           WHERE is_active = TRUE AND is_ghost = FALSE AND updated_at < $1`,
          [cutoff]
        );
        const staleEntries = staleCandidates.rows as { username: string; login_time_utc: unknown; updated_at: unknown }[];
        if (staleEntries.length > 0) {
          await client.query(
            `UPDATE profiles
             SET is_ghost = TRUE, ghost_started_at = $1, login_time_utc = 0, updated_at = $1
             WHERE is_active = TRUE AND is_ghost = FALSE AND updated_at < $2`,
            [now, cutoff]
          );
          for (const entry of staleEntries) {
            const staleMinutes = calculateSessionReadingMinutes(entry.login_time_utc, staleSessionEnd(entry.updated_at, now));
            if (staleMinutes >= 1) {
              await addDailyReadingMinutes(staleMinutes, now, client);
              await addDailyReaderMinutes(entry.username, staleMinutes, now, client);
            }
          }
        }

        const activeCountResult = await client.query(`
          SELECT COUNT(*)::int AS active_count
          FROM profiles
          WHERE is_active = TRUE AND updated_at > $1
        `, [cutoff]);
        const activeCount = Number(activeCountResult.rows[0]?.active_count ?? 0);
        const limit = await getActiveReaderLimit();
        const isAlreadyActive = wasActive;

        if (activeCount >= limit && !isAlreadyActive) {
          throw new Error('Active reader limit reached.');
        }
      }

      if (wasActive && !profile.isActive) {
        const sessionMinutes = calculateSessionReadingMinutes(previousLoginTimeUtc, now);
        await addDailyReadingMinutes(sessionMinutes, now, client);
        await addDailyReaderMinutes(profile.username, sessionMinutes, now, client);
      }

      const result = await client.query(
        `UPDATE profiles
         SET current_book = $2,
             current_author = $3,
             current_page = $4,
             total_page_count = $5,
             progress_mode = $6,
             books_data = $7,
             current_book_index = $8,
             favorite_authors = $9,
             status = $10,
             status_like_count = CASE WHEN status = $10 THEN status_like_count ELSE 0 END,
             position_x = $11,
             position_y = $12,
             avatar_icon = $13,
             avatar_image_data = $14,
             background_scene = $15,
             is_active = $16,
             login_time_utc = $17,
             updated_at = $18,
             recent_statuses_json = $19
         WHERE username = $1
           RETURNING username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, recent_statuses_json, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc, is_ghost, status_like_count`,
          [profile.username, safeSelectedBook.title, safeSelectedBook.author, safeSelectedBook.currentProgress, safeSelectedBook.totalProgress, safeSelectedBook.progressMode, serializeBooksData(safeBooks, profile.aboutMeBio, profile.aboutMeLink, profile.booksRead, profile.readingGoal), safeCurrentBookIndex, serializeFavoriteAuthors(profile.favoriteAuthors), safeStatus, toStoredPosition(profile.positionX), toStoredPosition(profile.positionY), profile.avatarIcon, safeAvatarImageData, profile.backgroundScene, profile.isActive, persistedLoginTimeUtc, now, JSON.stringify(nextRecentStatuses)]
      );

      await client.query('COMMIT');

      return mapProfileRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  try {
    await execSql('BEGIN');

    const currentState = await getSql<{ is_active?: number; login_time_utc?: number; status?: string; recent_statuses_json?: string }>(
      'SELECT is_active, login_time_utc, status, recent_statuses_json FROM profiles WHERE username = ?',
      [profile.username]
    );
    const wasActive = currentState?.is_active === 1;
    const previousLoginTimeUtc = Number(currentState?.login_time_utc ?? 0);
    const currentStatus = String(currentState?.status ?? '');
    const recentStatuses = normalizeRecentStatuses(currentState?.recent_statuses_json);
    const previousStatus = currentStatus.trim();
    const nextRecentStatuses = normalizeRecentStatuses([
      ...(previousStatus && previousStatus !== 'Reading' && previousStatus !== safeStatus.trim() ? [previousStatus] : []),
      ...recentStatuses,
    ].filter((entry) => entry !== safeStatus.trim()));

    if (enforceActiveLimit && profile.isActive) {
      const staleRows = await allSql<{ username?: string; login_time_utc?: number; updated_at?: number }>(`
        SELECT username, login_time_utc, updated_at
        FROM profiles
        WHERE is_active = 1 AND is_ghost = 0 AND updated_at < ?
      `, [cutoff]);

      if (staleRows.length > 0) {
        await runSql(`
          UPDATE profiles
          SET is_ghost = 1, ghost_started_at = ?, login_time_utc = 0, updated_at = ?
          WHERE is_active = 1 AND is_ghost = 0 AND updated_at < ?
        `, [now, now, cutoff]);

        for (const row of staleRows) {
          const staleUsername = String(row.username ?? '');
          if (!staleUsername) {
            continue;
          }
          const staleMinutes = calculateSessionReadingMinutes(row.login_time_utc, staleSessionEnd(row.updated_at, now));
          if (staleMinutes >= 1) {
            await addDailyReadingMinutes(staleMinutes, now);
            await addDailyReaderMinutes(staleUsername, staleMinutes, now);
          }
        }
      }

      const activeCountRow = await getSql<{ active_count?: number }>(`
        SELECT COUNT(*) AS active_count
        FROM profiles
        WHERE is_active = 1 AND updated_at > ?
      `, [cutoff]);
      const activeCount = Number(activeCountRow?.active_count ?? 0);
      const limit = await getActiveReaderLimit();
      const isAlreadyActive = wasActive;

      if (activeCount >= limit && !isAlreadyActive) {
        throw new Error('Active reader limit reached.');
      }
    }

    if (wasActive && !profile.isActive) {
      const sessionMinutes = calculateSessionReadingMinutes(previousLoginTimeUtc, now);
      await addDailyReadingMinutes(sessionMinutes, now);
      await addDailyReaderMinutes(profile.username, sessionMinutes, now);
    }

    await runSql(`
INSERT INTO profiles(username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc, updated_at, recent_statuses_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        current_book = excluded.current_book,
        current_author = excluded.current_author,
        current_page = excluded.current_page,
        total_page_count = excluded.total_page_count,
        progress_mode = excluded.progress_mode,
        books_data = excluded.books_data,
        current_book_index = excluded.current_book_index,
        favorite_authors = excluded.favorite_authors,
        status = excluded.status,
        status_like_count = CASE WHEN profiles.status = excluded.status THEN profiles.status_like_count ELSE 0 END,
        position_x = excluded.position_x,
        position_y = excluded.position_y,
        avatar_icon = excluded.avatar_icon,
        avatar_image_data = excluded.avatar_image_data,
        background_scene = excluded.background_scene,
        is_active = excluded.is_active,
        login_time_utc = excluded.login_time_utc,
        updated_at = excluded.updated_at,
        recent_statuses_json = excluded.recent_statuses_json
    `, [
      profile.username,
      safeSelectedBook.title,
      safeSelectedBook.author,
      safeSelectedBook.currentProgress,
      safeSelectedBook.totalProgress,
      safeSelectedBook.progressMode,
      serializeBooksData(safeBooks, profile.aboutMeBio, profile.aboutMeLink, profile.booksRead, profile.readingGoal),
      safeCurrentBookIndex,
      serializeFavoriteAuthors(profile.favoriteAuthors),
      safeStatus,
      toStoredPosition(profile.positionX),
      toStoredPosition(profile.positionY),
      profile.avatarIcon,
      safeAvatarImageData,
      profile.backgroundScene,
      profile.isActive ? 1 : 0,
      persistedLoginTimeUtc,
      now,
      JSON.stringify(nextRecentStatuses),
    ]);

    await execSql('COMMIT');

    const row = await getSql<any>(`
      SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, recent_statuses_json, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc, is_ghost, status_like_count
      FROM profiles
      WHERE username = ?
    `, [profile.username]);

    return mapProfileRow(row);
  } catch (error) {
    await execSql('ROLLBACK');
    throw error;
  }
}

export async function resetActiveReaders(): Promise<void> {
  const now = Date.now();

  if (databaseType === 'postgres') {
    await pool.query(`
      UPDATE profiles
      SET is_active = FALSE, is_ghost = FALSE, ghost_started_at = 0, login_time_utc = 0, updated_at = $1
      WHERE is_active = TRUE
    `, [now]);
    return;
  }

  await runSql(`
    UPDATE profiles
    SET is_active = 0, is_ghost = 0, ghost_started_at = 0, login_time_utc = 0, updated_at = ?
    WHERE is_active = 1
  `, [now]);
}

export async function listDailyBulletinPosts(): Promise<BulletinPost[]> {
  const dayKey = await purgeStaleBulletinRowsForToday();
  const yesterday = previousDayKey(dayKey);

  if (databaseType === 'postgres') {
    const result = await pool.query(
      `SELECT day_key, post_id, author, avatar_icon, avatar_image_data, content_text, image_data, like_count, created_at
       FROM bulletin_posts
      WHERE day_key IN ($1, $2)
      ORDER BY created_at DESC, post_id DESC`,
          [dayKey, yesterday]
    );
    return result.rows.map(mapBulletinRow);
  }

  const rows = await allSql<any>(
    `SELECT day_key, post_id, author, avatar_icon, avatar_image_data, content_text, image_data, like_count, created_at
     FROM bulletin_posts
    WHERE day_key IN (?, ?)
    ORDER BY created_at DESC, post_id DESC`,
      [dayKey, yesterday]
  );
  return rows.map(mapBulletinRow);
}

async function allocateBulletinPostId(): Promise<number> {
  if (databaseType === 'postgres') {
    const result = await pool.query(
      `UPDATE bulletin_post_sequence
       SET next_id = next_id + 1
       WHERE sequence_id = 1
       RETURNING next_id - 1 AS post_id`
    );
    const postId = Number(result.rows[0]?.post_id);
    if (!Number.isSafeInteger(postId) || postId < 1) {
      throw new Error('Unable to allocate bulletin post id.');
    }
    return postId;
  }

  await execSql('BEGIN IMMEDIATE');
  try {
    const row = await getSql<{ next_id?: number }>(
      'SELECT next_id FROM bulletin_post_sequence WHERE sequence_id = 1'
    );
    const postId = Number(row?.next_id);
    if (!Number.isSafeInteger(postId) || postId < 1) {
      throw new Error('Unable to allocate bulletin post id.');
    }
    await runSql('UPDATE bulletin_post_sequence SET next_id = ? WHERE sequence_id = 1', [postId + 1]);
    await execSql('COMMIT');
    return postId;
  } catch (error) {
    await execSql('ROLLBACK');
    throw error;
  }
}

export async function createDailyBulletinPost(input: {
  author: string;
  text: string;
  avatarIcon?: string;
  avatarImageData?: string;
  imageData?: string;
}): Promise<BulletinPost> {
  const author = typeof input.author === 'string' ? input.author.trim().slice(0, 60) : '';
  const text = normalizeBulletinText(input.text);
  const imageData = normalizeBulletinImageData(input.imageData);
  if (!author) {
    throw new Error('author is required');
  }
  if (!text && !imageData) {
    throw new Error('text or image is required');
  }

  const avatarIcon = normalizeAvatarIcon(input.avatarIcon);
  const avatarImageData = normalizeAvatarImageData(input.avatarImageData);
  const createdAt = Date.now();
  const dayKey = await purgeStaleBulletinRowsForToday();
  const postId = await allocateBulletinPostId();

  if (databaseType === 'postgres') {
    const insertResult = await pool.query(
      `INSERT INTO bulletin_posts(day_key, post_id, author, avatar_icon, avatar_image_data, content_text, image_data, like_count, created_at)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING day_key, post_id, author, avatar_icon, avatar_image_data, content_text, image_data, like_count, created_at`,
      [dayKey, postId, author, avatarIcon, avatarImageData, text, imageData, 0, createdAt]
    );
    return mapBulletinRow(insertResult.rows[0]);
  }

  await runSql(
    `INSERT INTO bulletin_posts(day_key, post_id, author, avatar_icon, avatar_image_data, content_text, image_data, like_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [dayKey, postId, author, avatarIcon, avatarImageData, text, imageData, 0, createdAt]
  );
  const row = await getSql<any>(
    `SELECT day_key, post_id, author, avatar_icon, avatar_image_data, content_text, image_data, like_count, created_at
     FROM bulletin_posts
     WHERE day_key = ? AND post_id = ?`,
    [dayKey, postId]
  );
  return mapBulletinRow(row);
}

function mapChatRow(row: any): ChatMessage {
  return {
    dayKey: String(row.day_key ?? ''),
    messageId: Number(row.message_id ?? 0),
    author: typeof row.author === 'string' ? row.author : '',
    avatarIcon: normalizeAvatarIcon(row.avatar_icon),
    avatarImageData: normalizeAvatarImageData(row.avatar_image_data),
    text: typeof row.content_text === 'string' ? row.content_text : '',
    imageData: normalizeBulletinImageData(row.image_data),
    createdAt: Number(row.created_at ?? 0),
    toUsername: typeof row.to_username === 'string' ? row.to_username : '',
    toAvatarIcon: typeof row.to_username === 'string' && row.to_username ? normalizeAvatarIcon(row.to_avatar_icon) : '',
    toAvatarImageData: typeof row.to_username === 'string' && row.to_username ? normalizeAvatarImageData(row.to_avatar_image_data) : '',
    bookTitle: typeof row.book_title === 'string' ? row.book_title : '',
    likeCount: normalizeLikeCount(row.like_count),
  };
}

async function purgeStaleChatRowsForToday(): Promise<string> {
  const today = toLocalDayKey();
  const yesterday = previousDayKey(today);

  if (databaseType === 'postgres') {
    await pool.query('DELETE FROM chat_messages WHERE day_key <> $1 AND day_key <> $2', [today, yesterday]);
    await pool.query('DELETE FROM chat_pings WHERE day_key <> $1', [today]);
    return today;
  }

  await runSql('DELETE FROM chat_messages WHERE day_key <> ? AND day_key <> ?', [today, yesterday]);
  await runSql('DELETE FROM chat_pings WHERE day_key <> ?', [today]);
  return today;
}

export async function maintainChatRetention(): Promise<void> {
  await purgeStaleChatRowsForToday();
}

export async function listChatMessages(requestedDayKey: string, afterId: number): Promise<{ dayKey: string; messages: ChatMessage[]; messageIds: number[]; likeCounts: Record<string, number> }> {
  const dayKey = await purgeStaleChatRowsForToday();
  const yesterday = previousDayKey(dayKey);
  // A client holding another day's cursor gets the full two-day window.
  const safeAfterId = requestedDayKey === dayKey && Number.isFinite(afterId) && afterId > 0 ? Math.floor(afterId) : 0;

  if (databaseType === 'postgres') {
    const result = await pool.query(
      `SELECT day_key, message_id, author, avatar_icon, avatar_image_data, content_text, image_data, created_at, to_username, to_avatar_icon, to_avatar_image_data, book_title, like_count
       FROM chat_messages
       WHERE day_key IN ($1, $2) AND message_id > $3
       ORDER BY message_id ASC`,
      [dayKey, yesterday, safeAfterId]
    );
    // Ids and like counts cover both retained days so clients sync deletion and likes.
    const idResult = await pool.query('SELECT message_id, like_count FROM chat_messages WHERE day_key IN ($1, $2)', [dayKey, yesterday]);
    const likeCounts: Record<string, number> = {};
    for (const row of idResult.rows as any[]) {
      likeCounts[String(row.message_id)] = normalizeLikeCount(row.like_count);
    }
    return { dayKey, messages: result.rows.map(mapChatRow), messageIds: idResult.rows.map((row: any) => Number(row.message_id)), likeCounts };
  }

  const rows = await allSql<any>(
    `SELECT day_key, message_id, author, avatar_icon, avatar_image_data, content_text, image_data, created_at, to_username, to_avatar_icon, to_avatar_image_data, book_title, like_count
     FROM chat_messages
     WHERE day_key IN (?, ?) AND message_id > ?
     ORDER BY message_id ASC`,
    [dayKey, yesterday, safeAfterId]
  );
  const idRows = await allSql<{ message_id?: number; like_count?: number }>('SELECT message_id, like_count FROM chat_messages WHERE day_key IN (?, ?)', [dayKey, yesterday]);
  const likeCounts: Record<string, number> = {};
  for (const row of idRows) {
    likeCounts[String(row.message_id)] = normalizeLikeCount(row.like_count);
  }
  return { dayKey, messages: rows.map(mapChatRow), messageIds: idRows.map((row) => Number(row.message_id)), likeCounts };
}

const CHAT_MESSAGE_COLUMNS = 'day_key, message_id, author, avatar_icon, avatar_image_data, content_text, image_data, created_at, to_username, to_avatar_icon, to_avatar_image_data, book_title, like_count';

async function allocateChatMessageId(): Promise<number> {
  if (databaseType === 'postgres') {
    const result = await pool.query(
      `UPDATE chat_message_sequence
       SET next_id = next_id + 1
       WHERE sequence_id = 1
       RETURNING next_id - 1 AS message_id`
    );
    const messageId = Number(result.rows[0]?.message_id);
    if (!Number.isSafeInteger(messageId) || messageId < 1) {
      throw new Error('Unable to allocate chat message id.');
    }
    return messageId;
  }

  await execSql('BEGIN IMMEDIATE');
  try {
    const row = await getSql<{ next_id?: number }>(
      'SELECT next_id FROM chat_message_sequence WHERE sequence_id = 1'
    );
    const messageId = Number(row?.next_id);
    if (!Number.isSafeInteger(messageId) || messageId < 1) {
      throw new Error('Unable to allocate chat message id.');
    }
    await runSql('UPDATE chat_message_sequence SET next_id = ? WHERE sequence_id = 1', [messageId + 1]);
    await execSql('COMMIT');
    return messageId;
  } catch (error) {
    await execSql('ROLLBACK');
    throw error;
  }
}

export async function setChatMessageLike(messageId: number, delta: 1 | -1): Promise<ChatMessage | null> {
  const safeId = Number.isFinite(messageId) ? Math.floor(messageId) : 0;
  if (safeId < 1) {
    return null;
  }

  await purgeStaleChatRowsForToday();

  if (databaseType === 'postgres') {
    const result = await pool.query(
      `UPDATE chat_messages SET like_count = GREATEST(0, like_count + $2)
       WHERE message_id = $1
       RETURNING ${CHAT_MESSAGE_COLUMNS}`,
      [safeId, delta]
    );
    return result.rowCount === 0 ? null : mapChatRow(result.rows[0]);
  }

  await runSql('UPDATE chat_messages SET like_count = MAX(0, like_count + ?) WHERE message_id = ?', [delta, safeId]);
  const row = await getSql<any>(`SELECT ${CHAT_MESSAGE_COLUMNS} FROM chat_messages WHERE message_id = ?`, [safeId]);
  return row ? mapChatRow(row) : null;
}

export async function deleteChatMessageByAuthor(messageId: number, author: string): Promise<'deleted' | 'forbidden' | 'not-found'> {
  const safeId = Number.isFinite(messageId) ? Math.floor(messageId) : 0;
  const safeAuthor = typeof author === 'string' ? author.trim().slice(0, 60) : '';
  if (safeId < 1 || !safeAuthor) {
    return 'not-found';
  }

  await purgeStaleChatRowsForToday();

  if (databaseType === 'postgres') {
    const existing = await pool.query('SELECT author FROM chat_messages WHERE message_id = $1', [safeId]);
    if (existing.rowCount === 0) {
      return 'not-found';
    }
    if (existing.rows[0].author !== safeAuthor) {
      return 'forbidden';
    }
    await pool.query('DELETE FROM chat_messages WHERE message_id = $1', [safeId]);
    return 'deleted';
  }

  const existing = await getSql<{ author?: string }>('SELECT author FROM chat_messages WHERE message_id = ?', [safeId]);
  if (!existing) {
    return 'not-found';
  }
  if (existing.author !== safeAuthor) {
    return 'forbidden';
  }
  await runSql('DELETE FROM chat_messages WHERE message_id = ?', [safeId]);
  return 'deleted';
}

export async function deleteChatMessage(messageId: number): Promise<boolean> {
  const safeId = Number.isFinite(messageId) ? Math.floor(messageId) : 0;
  if (safeId < 1) {
    return false;
  }

  await purgeStaleChatRowsForToday();

  if (databaseType === 'postgres') {
    const result = await pool.query('DELETE FROM chat_messages WHERE message_id = $1', [safeId]);
    return Number(result.rowCount ?? 0) > 0;
  }

  const existing = await getSql<{ message_id?: number }>('SELECT message_id FROM chat_messages WHERE message_id = ?', [safeId]);
  if (!existing) {
    return false;
  }
  await runSql('DELETE FROM chat_messages WHERE message_id = ?', [safeId]);
  return true;
}

export async function createChatMessage(input: {
  author: string;
  text: string;
  avatarIcon?: string;
  avatarImageData?: string;
  imageData?: string;
  toUsername?: string;
  toAvatarIcon?: string;
  toAvatarImageData?: string;
  bookTitle?: string;
}): Promise<ChatMessage> {
  const author = typeof input.author === 'string' ? input.author.trim().slice(0, 60) : '';
  const text = normalizeBulletinText(input.text);
  const imageData = normalizeBulletinImageData(input.imageData);
  const toUsername = typeof input.toUsername === 'string' ? input.toUsername.trim().slice(0, 60) : '';
  const toAvatarIcon = toUsername ? normalizeAvatarIcon(input.toAvatarIcon) : '';
  const toAvatarImageData = toUsername ? normalizeAvatarImageData(input.toAvatarImageData) : '';
  const bookTitle = toUsername && typeof input.bookTitle === 'string' ? input.bookTitle.trim().slice(0, 160) : '';
  if (!author) {
    throw new Error('author is required');
  }
  if (!text && !imageData) {
    throw new Error('text or image is required');
  }

  const avatarIcon = normalizeAvatarIcon(input.avatarIcon);
  const avatarImageData = normalizeAvatarImageData(input.avatarImageData);
  const createdAt = Date.now();
  const dayKey = await purgeStaleChatRowsForToday();

  // The sequence is persistent across daily retention purges, so ids are globally unique.
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const messageId = await allocateChatMessageId();
      if (databaseType === 'postgres') {
        const insertResult = await pool.query(
          `INSERT INTO chat_messages(day_key, message_id, author, avatar_icon, avatar_image_data, content_text, image_data, created_at, to_username, to_avatar_icon, to_avatar_image_data, book_title)
           VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING day_key, message_id, author, avatar_icon, avatar_image_data, content_text, image_data, created_at, to_username, to_avatar_icon, to_avatar_image_data, book_title, like_count`,
          [dayKey, messageId, author, avatarIcon, avatarImageData, text, imageData, createdAt, toUsername, toAvatarIcon, toAvatarImageData, bookTitle]
        );
        return mapChatRow(insertResult.rows[0]);
      }

      await runSql(
        `INSERT INTO chat_messages(day_key, message_id, author, avatar_icon, avatar_image_data, content_text, image_data, created_at, to_username, to_avatar_icon, to_avatar_image_data, book_title)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dayKey, messageId, author, avatarIcon, avatarImageData, text, imageData, createdAt, toUsername, toAvatarIcon, toAvatarImageData, bookTitle]
      );
      const row = await getSql<any>(
        `SELECT day_key, message_id, author, avatar_icon, avatar_image_data, content_text, image_data, created_at, to_username, to_avatar_icon, to_avatar_image_data, book_title, like_count
         FROM chat_messages WHERE day_key = ? AND message_id = ?`,
        [dayKey, messageId]
      );
      return mapChatRow(row);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function createChatPing(input: { from: string; to: string; bookTitle?: string }): Promise<void> {
  const from = typeof input.from === 'string' ? input.from.trim().slice(0, 60) : '';
  const to = typeof input.to === 'string' ? input.to.trim().slice(0, 60) : '';
  const bookTitle = typeof input.bookTitle === 'string' ? input.bookTitle.trim().slice(0, 160) : '';
  if (!from || !to) {
    throw new Error('from and to are required');
  }
  if (from === to) {
    return;
  }

  const dayKey = await purgeStaleChatRowsForToday();
  const now = Date.now();

  if (databaseType === 'postgres') {
    await pool.query(
      `INSERT INTO chat_pings(day_key, target_username, from_username, book_title, created_at)
       VALUES($1, $2, $3, $4, $5)
       ON CONFLICT (day_key, target_username, from_username) DO UPDATE
       SET book_title = $4, created_at = $5`,
      [dayKey, to, from, bookTitle, now]
    );
    return;
  }

  await runSql(
    `INSERT INTO chat_pings(day_key, target_username, from_username, book_title, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(day_key, target_username, from_username) DO UPDATE SET
       book_title = excluded.book_title,
       created_at = excluded.created_at`,
    [dayKey, to, from, bookTitle, now]
  );
}

export async function listChatPings(username: string): Promise<ChatPing[]> {
  const target = typeof username === 'string' ? username.trim() : '';
  if (!target) {
    return [];
  }
  const dayKey = await purgeStaleChatRowsForToday();

  if (databaseType === 'postgres') {
    const result = await pool.query(
      `SELECT from_username, book_title, created_at FROM chat_pings
       WHERE day_key = $1 AND target_username = $2 ORDER BY created_at DESC`,
      [dayKey, target]
    );
    return result.rows.map((row: any) => ({
      fromUsername: String(row.from_username ?? ''),
      bookTitle: String(row.book_title ?? ''),
      createdAt: Number(row.created_at ?? 0),
    }));
  }

  const rows = await allSql<any>(
    `SELECT from_username, book_title, created_at FROM chat_pings
     WHERE day_key = ? AND target_username = ? ORDER BY created_at DESC`,
    [dayKey, target]
  );
  return rows.map((row) => ({
    fromUsername: String(row.from_username ?? ''),
    bookTitle: String(row.book_title ?? ''),
    createdAt: Number(row.created_at ?? 0),
  }));
}

export async function clearChatPings(username: string): Promise<void> {
  const target = typeof username === 'string' ? username.trim() : '';
  if (!target) {
    return;
  }

  if (databaseType === 'postgres') {
    await pool.query('DELETE FROM chat_pings WHERE target_username = $1', [target]);
    return;
  }

  await runSql('DELETE FROM chat_pings WHERE target_username = ?', [target]);
}

export async function setDailyBulletinPostLike(postId: number, delta: 1 | -1): Promise<BulletinPost | null> {
  const safePostId = Number.isFinite(postId) ? Math.floor(postId) : 0;
  if (safePostId < 1) {
    return null;
  }

  await purgeStaleBulletinRowsForToday();

  if (databaseType === 'postgres') {
    const result = await pool.query(
      `UPDATE bulletin_posts
      SET like_count = GREATEST(0, like_count + $2)
       WHERE post_id = $1
       RETURNING day_key, post_id, author, avatar_icon, avatar_image_data, content_text, image_data, like_count, created_at`,
      [safePostId, delta]
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapBulletinRow(result.rows[0]);
  }

  await runSql(
    `UPDATE bulletin_posts
     SET like_count = MAX(0, like_count + ?)
      WHERE post_id = ?`,
        [delta, safePostId]
  );
  const row = await getSql<any>(
    `SELECT day_key, post_id, author, avatar_icon, avatar_image_data, content_text, image_data, like_count, created_at
     FROM bulletin_posts
    WHERE post_id = ?`,
      [safePostId]
  );
  return row ? mapBulletinRow(row) : null;
}

export async function getDailyVisitStats(): Promise<DailyVisitStats> {
  const dayKey = await purgeStaleDailyVisitRowsForToday();
  const now = Date.now();

  if (databaseType === 'postgres') {
    const result = await pool.query(
      'SELECT day_key, visit_count, users_json, total_reading_minutes FROM daily_visit_stats WHERE day_key = $1',
      [dayKey]
    );
    if (!result.rows[0]) {
      return {
        dayKey,
        visitCount: 0,
        userCount: 0,
        totalReadingMinutes: await getLiveActiveReadingMinutes(now),
      };
    }
    const usernames = parseDailyVisitorUsernames(result.rows[0].users_json);
    const storedStats = toDailyVisitStats(dayKey, result.rows[0].visit_count, usernames, result.rows[0].total_reading_minutes);
    const liveActiveMinutes = await getLiveActiveReadingMinutes(now);
    return {
      ...storedStats,
      totalReadingMinutes: storedStats.totalReadingMinutes + liveActiveMinutes,
    };
  }

  const row = await getSql<{ visit_count?: number; users_json?: string; total_reading_minutes?: number }>(
    'SELECT visit_count, users_json, total_reading_minutes FROM daily_visit_stats WHERE day_key = ?',
    [dayKey]
  );
  if (!row) {
    return {
      dayKey,
      visitCount: 0,
      userCount: 0,
      totalReadingMinutes: await getLiveActiveReadingMinutes(now),
    };
  }

  const usernames = parseDailyVisitorUsernames(row.users_json);
  const storedStats = toDailyVisitStats(dayKey, row.visit_count, usernames, row.total_reading_minutes);
  const liveActiveMinutes = await getLiveActiveReadingMinutes(now);
  return {
    ...storedStats,
    totalReadingMinutes: storedStats.totalReadingMinutes + liveActiveMinutes,
  };
}

export async function getTopDailyReaders(limit = 3): Promise<DailyTopReader[]> {
  const dayKey = await purgeStaleDailyReaderMinutesRowsForToday();
  const now = Date.now();

  const combined = new Map<string, number>();

  if (databaseType === 'postgres') {
    const result = await pool.query(
      'SELECT username, minutes FROM daily_reader_minutes WHERE day_key = $1',
      [dayKey]
    );
    for (const row of result.rows as { username?: string; minutes?: unknown }[]) {
      const username = String(row.username ?? '');
      if (username) {
        combined.set(username, normalizeReadingMinutes(row.minutes));
      }
    }
  } else {
    const rows = await allSql<{ username?: string; minutes?: number }>(
      'SELECT username, minutes FROM daily_reader_minutes WHERE day_key = ?',
      [dayKey]
    );
    for (const row of rows) {
      const username = String(row.username ?? '');
      if (username) {
        combined.set(username, normalizeReadingMinutes(row.minutes));
      }
    }
  }

  const liveMinutes = await getLiveActiveReaderMinutes(now);
  for (const [username, minutes] of liveMinutes) {
    combined.set(username, (combined.get(username) ?? 0) + minutes);
  }

  return Array.from(combined.entries())
    .map(([username, minutes]) => ({ username, minutes }))
    .filter((entry) => entry.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, limit);
}

export async function listTodayChatReaders(): Promise<Array<{ username: string; avatarIcon: string; avatarImageData: string }>> {
  const today = toLocalDayKey();
  const query = `SELECT profiles.username, profiles.avatar_icon, profiles.avatar_image_data
    FROM profiles JOIN reader_streaks ON reader_streaks.username = profiles.username
    WHERE reader_streaks.last_login_day_key = ${databaseType === 'postgres' ? '$1' : '?'}
    ORDER BY profiles.username ASC`;
  const rows = databaseType === 'postgres'
    ? (await pool.query(query, [today])).rows
    : await allSql<{ username: string; avatar_icon: string; avatar_image_data: string }>(query, [today]);
  return rows.map((row: { username: string; avatar_icon: string; avatar_image_data: string }) => ({
    username: row.username,
    avatarIcon: normalizeAvatarIcon(row.avatar_icon),
    avatarImageData: normalizeAvatarImageData(row.avatar_image_data),
  }));
}

function previousDayKey(dayKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) {
    return '';
  }
  const [, yearText, monthText, dayText] = match;
  const asUtcMs = Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)) - 24 * 60 * 60 * 1000;
  const previous = new Date(asUtcMs);
  const year = previous.getUTCFullYear();
  const month = String(previous.getUTCMonth() + 1).padStart(2, '0');
  const day = String(previous.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function recordLoginStreak(username: string): Promise<number> {
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  if (!normalizedUsername) {
    return 0;
  }

  const now = Date.now();
  const today = toLocalDayKey(new Date(now));
  const yesterday = previousDayKey(today);

  if (databaseType === 'postgres') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'SELECT day_streak, last_login_day_key FROM reader_streaks WHERE username = $1 FOR UPDATE',
        [normalizedUsername]
      );
      const existing = result.rows[0] as { day_streak?: unknown; last_login_day_key?: unknown } | undefined;
      const previousStreak = normalizeReadingMinutes(existing?.day_streak);
      const lastLoginDayKey = typeof existing?.last_login_day_key === 'string' ? existing.last_login_day_key : '';

      let nextStreak: number;
      if (lastLoginDayKey === today) {
        nextStreak = previousStreak > 0 ? previousStreak : 1;
      } else if (lastLoginDayKey === yesterday) {
        nextStreak = previousStreak + 1;
      } else {
        nextStreak = 1;
      }

      await client.query(
        `INSERT INTO reader_streaks(username, day_streak, last_login_day_key, updated_at)
         VALUES($1, $2, $3, $4)
         ON CONFLICT (username) DO UPDATE
         SET day_streak = $2, last_login_day_key = $3, updated_at = $4`,
        [normalizedUsername, nextStreak, today, now]
      );

      await client.query('COMMIT');
      return nextStreak;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const existing = await getSql<{ day_streak?: number; last_login_day_key?: string }>(
    'SELECT day_streak, last_login_day_key FROM reader_streaks WHERE username = ?',
    [normalizedUsername]
  );
  const previousStreak = normalizeReadingMinutes(existing?.day_streak);
  const lastLoginDayKey = typeof existing?.last_login_day_key === 'string' ? existing.last_login_day_key : '';

  let nextStreak: number;
  if (lastLoginDayKey === today) {
    nextStreak = previousStreak > 0 ? previousStreak : 1;
  } else if (lastLoginDayKey === yesterday) {
    nextStreak = previousStreak + 1;
  } else {
    nextStreak = 1;
  }

  await runSql(
    `INSERT INTO reader_streaks(username, day_streak, last_login_day_key, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET
       day_streak = excluded.day_streak,
       last_login_day_key = excluded.last_login_day_key,
       updated_at = excluded.updated_at`,
    [normalizedUsername, nextStreak, today, now]
  );

  return nextStreak;
}

export async function recordDailyVisit(username: string): Promise<DailyVisitStats> {
  const normalizedUsername = normalizeDailyVisitorUsername(username);
  if (!normalizedUsername) {
    throw new Error('username is required');
  }

  const dayKey = await purgeStaleDailyVisitRowsForToday();
  const now = Date.now();

  if (databaseType === 'postgres') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO daily_visit_stats(day_key, visit_count, users_json, total_reading_minutes, updated_at)
         VALUES($1, 0, '[]', 0, $2)
         ON CONFLICT (day_key) DO NOTHING`,
        [dayKey, now]
      );

      const currentResult = await client.query(
        'SELECT visit_count, users_json, total_reading_minutes FROM daily_visit_stats WHERE day_key = $1 FOR UPDATE',
        [dayKey]
      );
      const current = currentResult.rows[0] ?? { visit_count: 0, users_json: '[]', total_reading_minutes: 0 };
      const usernames = parseDailyVisitorUsernames(current.users_json);
      if (!usernames.includes(normalizedUsername)) {
        usernames.push(normalizedUsername);
      }
      const nextVisitCount = normalizeVisitCount(current.visit_count) + 1;

      await client.query(
        'UPDATE daily_visit_stats SET visit_count = $2, users_json = $3, updated_at = $4 WHERE day_key = $1',
        [dayKey, nextVisitCount, serializeDailyVisitorUsernames(usernames), now]
      );

      await client.query('COMMIT');
      return toDailyVisitStats(dayKey, nextVisitCount, usernames, current.total_reading_minutes);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  try {
    await execSql('BEGIN');

    await runSql(
      `INSERT OR IGNORE INTO daily_visit_stats(day_key, visit_count, users_json, total_reading_minutes, updated_at)
       VALUES (?, 0, '[]', 0, ?)`,
      [dayKey, now]
    );

    const current = await getSql<{ visit_count?: number; users_json?: string; total_reading_minutes?: number }>(
      'SELECT visit_count, users_json, total_reading_minutes FROM daily_visit_stats WHERE day_key = ?',
      [dayKey]
    );

    const usernames = parseDailyVisitorUsernames(current?.users_json ?? '[]');
    if (!usernames.includes(normalizedUsername)) {
      usernames.push(normalizedUsername);
    }
    const nextVisitCount = normalizeVisitCount(current?.visit_count) + 1;

    await runSql(
      'UPDATE daily_visit_stats SET visit_count = ?, users_json = ?, updated_at = ? WHERE day_key = ?',
      [nextVisitCount, serializeDailyVisitorUsernames(usernames), now, dayKey]
    );

    await execSql('COMMIT');
    return toDailyVisitStats(dayKey, nextVisitCount, usernames, current?.total_reading_minutes ?? 0);
  } catch (error) {
    await execSql('ROLLBACK');
    throw error;
  }
}

export async function deleteDailyBulletinPost(postId: number): Promise<boolean> {
  const safePostId = Number.isFinite(postId) ? Math.floor(postId) : 0;
  if (safePostId < 1) {
    return false;
  }

  await purgeStaleBulletinRowsForToday();

  if (databaseType === 'postgres') {
    const result = await pool.query('DELETE FROM bulletin_posts WHERE post_id = $1', [safePostId]);
    return Number(result.rowCount ?? 0) > 0;
  }

  await runSql('DELETE FROM bulletin_posts WHERE post_id = ?', [safePostId]);
  const row = await getSql<{ count?: number }>(
    'SELECT COUNT(*) AS count FROM bulletin_posts WHERE post_id = ?',
    [safePostId]
  );
  return Number(row?.count ?? 0) === 0;
}

export async function deleteDailyBulletinPostByAuthor(postId: number, author: string): Promise<'deleted' | 'forbidden' | 'not-found'> {
  const safePostId = Number.isFinite(postId) ? Math.floor(postId) : 0;
  const trimmedAuthor = typeof author === 'string' ? author.trim() : '';
  if (safePostId < 1 || !trimmedAuthor) {
    return 'not-found';
  }

  await purgeStaleBulletinRowsForToday();

  if (databaseType === 'postgres') {
    const currentResult = await pool.query(
      'SELECT author FROM bulletin_posts WHERE post_id = $1',
      [safePostId]
    );
    const currentAuthor = typeof currentResult.rows[0]?.author === 'string' ? currentResult.rows[0].author.trim() : '';
    if (!currentAuthor) {
      return 'not-found';
    }
    if (currentAuthor !== trimmedAuthor) {
      return 'forbidden';
    }

    const result = await pool.query('DELETE FROM bulletin_posts WHERE post_id = $1', [safePostId]);
    return Number(result.rowCount ?? 0) > 0 ? 'deleted' : 'not-found';
  }

  const row = await getSql<{ author?: string }>(
    'SELECT author FROM bulletin_posts WHERE post_id = ?',
    [safePostId]
  );
  const currentAuthor = typeof row?.author === 'string' ? row.author.trim() : '';
  if (!currentAuthor) {
    return 'not-found';
  }
  if (currentAuthor !== trimmedAuthor) {
    return 'forbidden';
  }

  await runSql('DELETE FROM bulletin_posts WHERE post_id = ?', [safePostId]);
  return 'deleted';
}

export async function resetDailyBulletinBoard(): Promise<void> {
  if (databaseType === 'postgres') {
    await pool.query('DELETE FROM bulletin_posts');
    return;
  }
  await runSql('DELETE FROM bulletin_posts');
}

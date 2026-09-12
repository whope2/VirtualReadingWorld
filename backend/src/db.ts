import path from 'path';
import { mkdirSync } from 'fs';
import sqlite3 from 'sqlite3';

const DEFAULT_ACTIVE_READER_LIMIT = 10;
const POSITION_SCALE = 10000;
const INACTIVITY_WINDOW_MS = 60 * 60 * 1000;
const INACTIVITY_READING_MINUTES = 60;
const BULLETIN_TEXT_MAX_LENGTH = 800;
const BULLETIN_TIME_ZONE = 'America/New_York';
const PROFILE_BOOK_SLOT_COUNT = 4;
const BETWEEN_BOOKS_INDEX = 3;
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
  favoriteAuthors: string[];
  status: string;
  positionX: number;
  positionY: number;
  avatarIcon: string;
  avatarImageData: string;
  backgroundScene: string;
  isActive: boolean;
  loginTimeUtc: number;
};

export type ProfileBook = {
  title: string;
  author: string;
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

async function deactivateStaleProfilesAndAccrue(now: number, cutoff: number): Promise<void> {
  if (databaseType === 'postgres') {
    const staleResult = await pool.query(
      `UPDATE profiles
       SET is_active = FALSE, login_time_utc = 0, updated_at = $1
       WHERE is_active = TRUE AND updated_at < $2
       RETURNING username`,
      [now, cutoff]
    );
    const staleCount = Number(staleResult.rowCount ?? 0);
    if (staleCount > 0) {
      await addDailyReadingMinutes(staleCount * INACTIVITY_READING_MINUTES, now);
    }
    return;
  }

  const staleRow = await getSql<{ stale_count?: number }>(
    'SELECT COUNT(*) AS stale_count FROM profiles WHERE is_active = 1 AND updated_at < ?',
    [cutoff]
  );
  const staleCount = Number(staleRow?.stale_count ?? 0);

  await runSql(
    `UPDATE profiles
     SET is_active = 0, login_time_utc = 0, updated_at = ?
     WHERE is_active = 1 AND updated_at < ?`,
    [now, cutoff]
  );

  if (staleCount > 0) {
    await addDailyReadingMinutes(staleCount * INACTIVITY_READING_MINUTES, now);
  }
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

  if (databaseType === 'postgres') {
    await pool.query('DELETE FROM bulletin_posts WHERE day_key <> $1', [today]);
    return today;
  }

  await runSql('DELETE FROM bulletin_posts WHERE day_key <> ?', [today]);
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
  if (index === BETWEEN_BOOKS_INDEX) {
    return {
      title: BETWEEN_BOOKS_TITLE,
      author: '',
      currentProgress: 0,
      totalProgress: 0,
      currentRating: 0,
      likeCount: 0,
      format: 'physical',
      progressMode: 'pages',
    };
  }

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

function normalizeBetweenBookEntry(book: ProfileBook): ProfileBook {
  return {
    ...book,
    title: BETWEEN_BOOKS_TITLE,
    author: '',
    currentProgress: 0,
    totalProgress: 0,
    currentRating: 0,
    likeCount: 0,
    format: 'physical',
    progressMode: 'pages',
  };
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
      }
    } catch {
      rawBooks = [];
    }
  }

  const books: ProfileBook[] = [];
  for (let index = 0; index < PROFILE_BOOK_SLOT_COUNT; index += 1) {
    const fallback = index === 0 ? singleBookFallback : createDefaultBook(index);
    const normalizedBook = normalizeBookEntry(rawBooks[index], fallback);
    books.push(index === BETWEEN_BOOKS_INDEX ? normalizeBetweenBookEntry(normalizedBook) : normalizedBook);
  }

  return books;
}

function serializeBooksData(books: ProfileBook[]): string {
  return JSON.stringify(books);
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
  const currentBookIndex = clampBookIndex(row.current_book_index ?? row.currentBookIndex ?? 0);
  const selectedBook = books[currentBookIndex] ?? books[0] ?? createDefaultBook(0);

  return {
    username: row.username,
    currentBook: selectedBook.title,
    currentAuthor: selectedBook.author,
    currentPage: selectedBook.currentProgress,
    totalPageCount: selectedBook.totalProgress,
    progressMode: selectedBook.progressMode,
    currentBookIndex,
    books,
    favoriteAuthors: parseFavoriteAuthors(row.favorite_authors ?? row.favoriteAuthors),
    status: normalizeStatus(row.status),
    positionX: fromStoredPosition(Number(row.position_x ?? row.positionX ?? 50)),
    positionY: fromStoredPosition(Number(row.position_y ?? row.positionY ?? 50)),
    avatarIcon: row.avatar_icon || row.avatarIcon || '📚',
    avatarImageData: typeof row.avatar_image_data === 'string' ? row.avatar_image_data : (typeof row.avatarImageData === 'string' ? row.avatarImageData : ''),
    backgroundScene: normalizeBackgroundScene(row.background_scene ?? row.backgroundScene),
    isActive: isActiveFlag(row.is_active ?? row.isActive),
    loginTimeUtc: Number(row.login_time_utc ?? row.loginTimeUtc ?? 0),
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
        position_x INTEGER NOT NULL DEFAULT 50,
        position_y INTEGER NOT NULL DEFAULT 50,
        avatar_icon TEXT NOT NULL DEFAULT '📚',
        avatar_image_data TEXT NOT NULL DEFAULT '',
        background_scene TEXT NOT NULL DEFAULT 'ocean-beach',
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        login_time_utc BIGINT NOT NULL DEFAULT 0,
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
      position_x INTEGER NOT NULL DEFAULT 50,
      position_y INTEGER NOT NULL DEFAULT 50,
      avatar_icon TEXT NOT NULL DEFAULT '📚',
      avatar_image_data TEXT NOT NULL DEFAULT '',
      background_scene TEXT NOT NULL DEFAULT 'ocean-beach',
      is_active INTEGER NOT NULL DEFAULT 0,
      login_time_utc INTEGER NOT NULL DEFAULT 0,
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
      'SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc FROM profiles WHERE username = $1',
      [username]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapProfileRow(result.rows[0]);
  }

  const row = await getSql<any>(`
    SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc
    FROM profiles
    WHERE username = ?
  `, [username]);

  if (!row) {
    return null;
  }

  return mapProfileRow(row);
}

export async function listProfiles(): Promise<Profile[]> {
  const now = Date.now();
  const cutoff = now - INACTIVITY_WINDOW_MS;
  const limit = await getActiveReaderLimit();

  await deactivateStaleProfilesAndAccrue(now, cutoff);

  if (databaseType === 'postgres') {
    const result = await pool.query(
      'SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc FROM profiles WHERE is_active = TRUE AND updated_at > $1 ORDER BY updated_at DESC, username ASC LIMIT $2',
      [cutoff, limit]
    );

    return result.rows.map(mapProfileRow);
  }

  const rows = await allSql<any>(`
    SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc
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
      'SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc FROM profiles ORDER BY updated_at DESC, username ASC'
    );
    return result.rows.map(mapProfileRow);
  }

  const rows = await allSql<any>(`
    SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc
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
    positionX: 0.5,
    positionY: 0.5,
    avatarIcon: '📚',
    avatarImageData: '',
    backgroundScene: 'ocean-beach',
    isActive: false,
    loginTimeUtc: 0,
  };

  if (databaseType === 'postgres') {
    await pool.query(
      'INSERT INTO profiles(username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc, updated_at) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) ON CONFLICT (username) DO NOTHING',
      [defaultProfile.username, defaultProfile.currentBook, defaultProfile.currentAuthor, defaultProfile.currentPage, defaultProfile.totalPageCount, defaultProfile.progressMode, serializeBooksData(defaultProfile.books), defaultProfile.currentBookIndex, serializeFavoriteAuthors(defaultProfile.favoriteAuthors), defaultProfile.status, toStoredPosition(defaultProfile.positionX), toStoredPosition(defaultProfile.positionY), defaultProfile.avatarIcon, defaultProfile.avatarImageData, defaultProfile.backgroundScene, defaultProfile.isActive, defaultProfile.loginTimeUtc, Date.now()]
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
    serializeBooksData(defaultProfile.books),
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
  const safeSelectedBook = normalizeBookEntry({
    ...safeBooks[safeCurrentBookIndex],
    title: profile.currentBook,
    author: profile.currentAuthor,
    currentProgress: profile.currentPage,
    totalProgress: profile.totalPageCount,
    progressMode: profile.progressMode,
  }, safeBooks[safeCurrentBookIndex] ?? legacySelectedBook);
  safeBooks[safeCurrentBookIndex] = safeCurrentBookIndex === BETWEEN_BOOKS_INDEX
    ? normalizeBetweenBookEntry(safeSelectedBook)
    : safeSelectedBook;

  const now = Date.now();
  const cutoff = now - INACTIVITY_WINDOW_MS;

  if (databaseType === 'postgres') {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const currentStateResult = await client.query(
        'SELECT is_active, login_time_utc FROM profiles WHERE username = $1 FOR UPDATE',
        [profile.username]
      );
      const wasActive = currentStateResult.rows[0]?.is_active === true;
      const previousLoginTimeUtc = Number(currentStateResult.rows[0]?.login_time_utc ?? 0);

      if (enforceActiveLimit && profile.isActive) {
        const staleResult = await client.query(`
          UPDATE profiles
          SET is_active = FALSE, login_time_utc = 0, updated_at = $1
          WHERE is_active = TRUE AND updated_at < $2
          RETURNING username
        `, [now, cutoff]);

        const staleCount = Number(staleResult.rowCount ?? 0);
        if (staleCount > 0) {
          await addDailyReadingMinutes(staleCount * INACTIVITY_READING_MINUTES, now, client);
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
             position_x = $11,
             position_y = $12,
             avatar_icon = $13,
             avatar_image_data = $14,
             background_scene = $15,
             is_active = $16,
             login_time_utc = $17,
             updated_at = $18
         WHERE username = $1
         RETURNING username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc`,
        [profile.username, safeSelectedBook.title, safeSelectedBook.author, safeSelectedBook.currentProgress, safeSelectedBook.totalProgress, safeSelectedBook.progressMode, serializeBooksData(safeBooks), safeCurrentBookIndex, serializeFavoriteAuthors(profile.favoriteAuthors), safeStatus, toStoredPosition(profile.positionX), toStoredPosition(profile.positionY), profile.avatarIcon, safeAvatarImageData, profile.backgroundScene, profile.isActive, persistedLoginTimeUtc, now]
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

    const currentState = await getSql<{ is_active?: number; login_time_utc?: number }>(
      'SELECT is_active, login_time_utc FROM profiles WHERE username = ?',
      [profile.username]
    );
    const wasActive = currentState?.is_active === 1;
    const previousLoginTimeUtc = Number(currentState?.login_time_utc ?? 0);

    if (enforceActiveLimit && profile.isActive) {
      const staleCountRow = await getSql<{ stale_count?: number }>(`
        SELECT COUNT(*) AS stale_count
        FROM profiles
        WHERE is_active = 1 AND updated_at < ?
      `, [cutoff]);
      const staleCount = Number(staleCountRow?.stale_count ?? 0);

      await runSql(`
        UPDATE profiles
        SET is_active = 0, login_time_utc = 0, updated_at = ?
        WHERE is_active = 1 AND updated_at < ?
      `, [now, cutoff]);

      if (staleCount > 0) {
        await addDailyReadingMinutes(staleCount * INACTIVITY_READING_MINUTES, now);
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
    }

    await runSql(`
INSERT INTO profiles(username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        position_x = excluded.position_x,
        position_y = excluded.position_y,
        avatar_icon = excluded.avatar_icon,
        avatar_image_data = excluded.avatar_image_data,
        background_scene = excluded.background_scene,
        is_active = excluded.is_active,
        login_time_utc = excluded.login_time_utc,
        updated_at = excluded.updated_at
    `, [
      profile.username,
      safeSelectedBook.title,
      safeSelectedBook.author,
      safeSelectedBook.currentProgress,
      safeSelectedBook.totalProgress,
      safeSelectedBook.progressMode,
      serializeBooksData(safeBooks),
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
    ]);

    await execSql('COMMIT');

    const row = await getSql<any>(`
      SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, avatar_image_data, background_scene, is_active, login_time_utc
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
      SET is_active = FALSE, updated_at = $1
      WHERE is_active = TRUE
    `, [now]);
    return;
  }

  await runSql(`
    UPDATE profiles
    SET is_active = 0, login_time_utc = 0, updated_at = ?
    WHERE is_active = 1
  `, [now]);
}

export async function listDailyBulletinPosts(): Promise<BulletinPost[]> {
  const dayKey = await purgeStaleBulletinRowsForToday();

  if (databaseType === 'postgres') {
    const result = await pool.query(
      `SELECT day_key, post_id, author, avatar_icon, avatar_image_data, content_text, image_data, like_count, created_at
       FROM bulletin_posts
       WHERE day_key = $1
       ORDER BY post_id DESC`,
      [dayKey]
    );
    return result.rows.map(mapBulletinRow);
  }

  const rows = await allSql<any>(
    `SELECT day_key, post_id, author, avatar_icon, avatar_image_data, content_text, image_data, like_count, created_at
     FROM bulletin_posts
     WHERE day_key = ?
     ORDER BY post_id DESC`,
    [dayKey]
  );
  return rows.map(mapBulletinRow);
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

  if (databaseType === 'postgres') {
    const nextIdResult = await pool.query(
      'SELECT COALESCE(MAX(post_id), 0) + 1 AS next_id FROM bulletin_posts WHERE day_key = $1',
      [dayKey]
    );
    const postId = Number(nextIdResult.rows[0]?.next_id ?? 1);
    const insertResult = await pool.query(
      `INSERT INTO bulletin_posts(day_key, post_id, author, avatar_icon, avatar_image_data, content_text, image_data, like_count, created_at)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING day_key, post_id, author, avatar_icon, avatar_image_data, content_text, image_data, like_count, created_at`,
      [dayKey, postId, author, avatarIcon, avatarImageData, text, imageData, 0, createdAt]
    );
    return mapBulletinRow(insertResult.rows[0]);
  }

  const nextIdRow = await getSql<{ next_id?: number }>(
    'SELECT COALESCE(MAX(post_id), 0) + 1 AS next_id FROM bulletin_posts WHERE day_key = ?',
    [dayKey]
  );
  const postId = Number(nextIdRow?.next_id ?? 1);
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

export async function setDailyBulletinPostLike(postId: number, delta: 1 | -1): Promise<BulletinPost | null> {
  const safePostId = Number.isFinite(postId) ? Math.floor(postId) : 0;
  if (safePostId < 1) {
    return null;
  }

  const dayKey = await purgeStaleBulletinRowsForToday();

  if (databaseType === 'postgres') {
    const result = await pool.query(
      `UPDATE bulletin_posts
       SET like_count = GREATEST(0, like_count + $3)
       WHERE day_key = $1 AND post_id = $2
       RETURNING day_key, post_id, author, avatar_icon, avatar_image_data, content_text, image_data, like_count, created_at`,
      [dayKey, safePostId, delta]
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapBulletinRow(result.rows[0]);
  }

  await runSql(
    `UPDATE bulletin_posts
     SET like_count = MAX(0, like_count + ?)
     WHERE day_key = ? AND post_id = ?`,
    [delta, dayKey, safePostId]
  );
  const row = await getSql<any>(
    `SELECT day_key, post_id, author, avatar_icon, avatar_image_data, content_text, image_data, like_count, created_at
     FROM bulletin_posts
     WHERE day_key = ? AND post_id = ?`,
    [dayKey, safePostId]
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

  const dayKey = await purgeStaleBulletinRowsForToday();

  if (databaseType === 'postgres') {
    const result = await pool.query('DELETE FROM bulletin_posts WHERE day_key = $1 AND post_id = $2', [dayKey, safePostId]);
    return Number(result.rowCount ?? 0) > 0;
  }

  await runSql('DELETE FROM bulletin_posts WHERE day_key = ? AND post_id = ?', [dayKey, safePostId]);
  const row = await getSql<{ count?: number }>(
    'SELECT COUNT(*) AS count FROM bulletin_posts WHERE day_key = ? AND post_id = ?',
    [dayKey, safePostId]
  );
  return Number(row?.count ?? 0) === 0;
}

export async function deleteDailyBulletinPostByAuthor(postId: number, author: string): Promise<'deleted' | 'forbidden' | 'not-found'> {
  const safePostId = Number.isFinite(postId) ? Math.floor(postId) : 0;
  const trimmedAuthor = typeof author === 'string' ? author.trim() : '';
  if (safePostId < 1 || !trimmedAuthor) {
    return 'not-found';
  }

  const dayKey = await purgeStaleBulletinRowsForToday();

  if (databaseType === 'postgres') {
    const currentResult = await pool.query(
      'SELECT author FROM bulletin_posts WHERE day_key = $1 AND post_id = $2',
      [dayKey, safePostId]
    );
    const currentAuthor = typeof currentResult.rows[0]?.author === 'string' ? currentResult.rows[0].author.trim() : '';
    if (!currentAuthor) {
      return 'not-found';
    }
    if (currentAuthor !== trimmedAuthor) {
      return 'forbidden';
    }

    const result = await pool.query('DELETE FROM bulletin_posts WHERE day_key = $1 AND post_id = $2', [dayKey, safePostId]);
    return Number(result.rowCount ?? 0) > 0 ? 'deleted' : 'not-found';
  }

  const row = await getSql<{ author?: string }>(
    'SELECT author FROM bulletin_posts WHERE day_key = ? AND post_id = ?',
    [dayKey, safePostId]
  );
  const currentAuthor = typeof row?.author === 'string' ? row.author.trim() : '';
  if (!currentAuthor) {
    return 'not-found';
  }
  if (currentAuthor !== trimmedAuthor) {
    return 'forbidden';
  }

  await runSql('DELETE FROM bulletin_posts WHERE day_key = ? AND post_id = ?', [dayKey, safePostId]);
  return 'deleted';
}

export async function resetDailyBulletinBoard(): Promise<void> {
  if (databaseType === 'postgres') {
    await pool.query('DELETE FROM bulletin_posts');
    return;
  }
  await runSql('DELETE FROM bulletin_posts');
}

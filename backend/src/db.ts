import path from 'path';
import { mkdirSync } from 'fs';
import sqlite3 from 'sqlite3';

const DEFAULT_ACTIVE_READER_LIMIT = 10;
const POSITION_SCALE = 10000;
const INACTIVITY_WINDOW_MS = 60 * 60 * 1000;

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
  if (value === 'lush-forest' || value === 'mountain-range' || value === 'ocean-beach' || value === 'lake') {
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
  backgroundScene: string;
  isActive: boolean;
};

export type ProfileBook = {
  title: string;
  author: string;
  currentProgress: number;
  totalProgress: number;
  format: 'physical' | 'ebook' | 'audiobook';
  progressMode: 'pages' | 'audio';
};

function createDefaultBook(index: number): ProfileBook {
  if (index === 0) {
    return {
      title: 'Untitled Beach Read',
      author: 'Unknown Author',
      currentProgress: 1,
      totalProgress: 0,
      format: 'physical',
      progressMode: 'pages',
    };
  }

  return {
    title: '',
    author: '',
    currentProgress: 0,
    totalProgress: 0,
    format: 'physical',
    progressMode: 'pages',
  };
}

function clampBookIndex(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(2, Math.max(0, Math.floor(parsed)));
}

function normalizeBookEntry(value: unknown, fallback: ProfileBook): ProfileBook {
  const source = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const format = normalizeBookFormat(source.format ?? fallback.format);
  const normalizedMode = format === 'audiobook' ? 'audio' : 'pages';
  const safeCurrent = Number(source.currentProgress ?? fallback.currentProgress ?? 0);
  const safeTotal = Number(source.totalProgress ?? fallback.totalProgress ?? 0);

  return {
    title: typeof source.title === 'string' ? source.title : fallback.title,
    author: typeof source.author === 'string' ? source.author : fallback.author,
    currentProgress: Number.isFinite(safeCurrent) && safeCurrent >= 0 ? Math.floor(safeCurrent) : 0,
    totalProgress: Number.isFinite(safeTotal) && safeTotal >= 0 ? Math.floor(safeTotal) : 0,
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
  for (let index = 0; index < 3; index += 1) {
    const fallback = index === 0 ? singleBookFallback : createDefaultBook(index);
    books.push(normalizeBookEntry(rawBooks[index], fallback));
  }

  return books;
}

function serializeBooksData(books: ProfileBook[]): string {
  return JSON.stringify(books);
}

function mapProfileRow(row: any): Profile {
  const singleBookFallback: ProfileBook = {
    title: row.current_book ?? row.currentBook ?? 'Untitled Beach Read',
    author: row.current_author ?? row.currentAuthor ?? 'Unknown Author',
    currentProgress: Number(row.current_page ?? row.currentPage ?? 0),
    totalProgress: Number(row.total_page_count ?? row.totalPageCount ?? 0),
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
    backgroundScene: normalizeBackgroundScene(row.background_scene ?? row.backgroundScene),
    isActive: isActiveFlag(row.is_active ?? row.isActive),
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
        background_scene TEXT NOT NULL DEFAULT 'ocean-beach',
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
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
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
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
      background_scene TEXT NOT NULL DEFAULT 'ocean-beach',
      is_active INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  await ensureSqliteColumn('total_page_count', 'INTEGER NOT NULL DEFAULT 0');
  await ensureSqliteColumn('progress_mode', "TEXT NOT NULL DEFAULT 'pages'");
  await ensureSqliteColumn('books_data', "TEXT NOT NULL DEFAULT '[]'");
  await ensureSqliteColumn('current_book_index', 'INTEGER NOT NULL DEFAULT 0');
  await ensureSqliteColumn('background_scene', "TEXT NOT NULL DEFAULT 'ocean-beach'");

  await execSql(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

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

  if (databaseType === 'postgres') {
    await pool.query(`
      UPDATE profiles
      SET is_active = FALSE, updated_at = $1
      WHERE is_active = TRUE AND updated_at < $2
    `, [now, cutoff]);

    const result = await pool.query(`
      SELECT COUNT(*)::int AS active_count
      FROM profiles
      WHERE is_active = TRUE AND updated_at > $1
    `, [cutoff]);

    return Number(result.rows[0]?.active_count ?? 0);
  }

  await runSql(`
    UPDATE profiles
    SET is_active = 0, updated_at = ?
    WHERE is_active = 1 AND updated_at < ?
  `, [now, cutoff]);

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

  if (databaseType === 'postgres') {
    await pool.query(`
      UPDATE profiles
      SET is_active = FALSE, updated_at = $1
      WHERE is_active = TRUE AND updated_at < $2
    `, [now, cutoff]);

    const result = await pool.query(
      'SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, background_scene, is_active FROM profiles WHERE username = $1',
      [username]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapProfileRow(result.rows[0]);
  }

  await runSql(`
    UPDATE profiles
    SET is_active = 0, updated_at = ?
    WHERE is_active = 1 AND updated_at < ?
  `, [now, cutoff]);

  const row = await getSql<any>(`
    SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, background_scene, is_active
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

  if (databaseType === 'postgres') {
    await pool.query(`
      UPDATE profiles
      SET is_active = FALSE, updated_at = $1
      WHERE is_active = TRUE AND updated_at < $2
    `, [now, cutoff]);

    const result = await pool.query(
      'SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, background_scene, is_active FROM profiles WHERE is_active = TRUE AND updated_at > $1 ORDER BY updated_at DESC, username ASC LIMIT $2',
      [cutoff, limit]
    );

    return result.rows.map(mapProfileRow);
  }

  await runSql(`
    UPDATE profiles
    SET is_active = 0, updated_at = ?
    WHERE is_active = 1 AND updated_at < ?
  `, [now, cutoff]);

  const rows = await allSql<any>(`
    SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, background_scene, is_active
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
      'SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, background_scene, is_active FROM profiles ORDER BY updated_at DESC, username ASC'
    );
    return result.rows.map(mapProfileRow);
  }

  const rows = await allSql<any>(`
    SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, background_scene, is_active
    FROM profiles
    ORDER BY updated_at DESC, username ASC
  `);

  return rows.map(mapProfileRow);
}

export async function createProfile(username: string): Promise<Profile> {
  const books = [createDefaultBook(0), createDefaultBook(1), createDefaultBook(2)];
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
    backgroundScene: 'ocean-beach',
    isActive: false,
  };

  if (databaseType === 'postgres') {
    await pool.query(
      'INSERT INTO profiles(username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, background_scene, is_active, updated_at) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) ON CONFLICT (username) DO NOTHING',
      [defaultProfile.username, defaultProfile.currentBook, defaultProfile.currentAuthor, defaultProfile.currentPage, defaultProfile.totalPageCount, defaultProfile.progressMode, serializeBooksData(defaultProfile.books), defaultProfile.currentBookIndex, serializeFavoriteAuthors(defaultProfile.favoriteAuthors), defaultProfile.status, toStoredPosition(defaultProfile.positionX), toStoredPosition(defaultProfile.positionY), defaultProfile.avatarIcon, defaultProfile.backgroundScene, defaultProfile.isActive, Date.now()]
    );
    return defaultProfile;
  }

  await runSql(`
    INSERT OR IGNORE INTO profiles(username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, background_scene, is_active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    defaultProfile.backgroundScene,
    defaultProfile.isActive ? 1 : 0,
    Date.now(),
  ]);

  return defaultProfile;
}

export async function updateProfile(profile: Profile, enforceActiveLimit = false): Promise<Profile> {
  const safeStatus = normalizeStatus(profile.status);
  const safeCurrentBookIndex = clampBookIndex(profile.currentBookIndex ?? 0);
  const legacySelectedBook: ProfileBook = {
    title: profile.currentBook,
    author: profile.currentAuthor,
    currentProgress: Number(profile.currentPage ?? 0),
    totalProgress: Number(profile.totalPageCount ?? 0),
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
  safeBooks[safeCurrentBookIndex] = safeSelectedBook;

  if (databaseType === 'postgres') {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (enforceActiveLimit && profile.isActive) {
        await client.query(`
          UPDATE profiles
          SET is_active = FALSE, updated_at = $1
          WHERE is_active = TRUE AND updated_at < $2
        `, [Date.now(), Date.now() - INACTIVITY_WINDOW_MS]);

        const activeCountResult = await client.query(`
          SELECT COUNT(*)::int AS active_count
          FROM profiles
          WHERE is_active = TRUE AND updated_at > $1
        `, [Date.now() - INACTIVITY_WINDOW_MS]);
        const activeCount = Number(activeCountResult.rows[0]?.active_count ?? 0);
        const limit = await getActiveReaderLimit();

        const currentStateResult = await client.query('SELECT is_active FROM profiles WHERE username = $1', [profile.username]);
        const isAlreadyActive = currentStateResult.rows[0]?.is_active === true;

        if (activeCount >= limit && !isAlreadyActive) {
          throw new Error('Active reader limit reached.');
        }
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
             background_scene = $14,
             is_active = $15,
             updated_at = $16
         WHERE username = $1
         RETURNING username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, background_scene, is_active`,
        [profile.username, safeSelectedBook.title, safeSelectedBook.author, safeSelectedBook.currentProgress, safeSelectedBook.totalProgress, safeSelectedBook.progressMode, serializeBooksData(safeBooks), safeCurrentBookIndex, serializeFavoriteAuthors(profile.favoriteAuthors), safeStatus, toStoredPosition(profile.positionX), toStoredPosition(profile.positionY), profile.avatarIcon, profile.backgroundScene, profile.isActive, Date.now()]
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

  const now = Date.now();
  const cutoff = now - INACTIVITY_WINDOW_MS;

  try {
    await execSql('BEGIN');

    if (enforceActiveLimit && profile.isActive) {
      await runSql(`
        UPDATE profiles
        SET is_active = 0, updated_at = ?
        WHERE is_active = 1 AND updated_at < ?
      `, [now, cutoff]);

      const activeCountRow = await getSql<{ active_count?: number }>(`
        SELECT COUNT(*) AS active_count
        FROM profiles
        WHERE is_active = 1 AND updated_at > ?
      `, [cutoff]);
      const activeCount = Number(activeCountRow?.active_count ?? 0);
      const limit = await getActiveReaderLimit();
      const currentState = await getSql<{ is_active?: number }>('SELECT is_active FROM profiles WHERE username = ?', [profile.username]);
      const isAlreadyActive = currentState?.is_active === 1;

      if (activeCount >= limit && !isAlreadyActive) {
        throw new Error('Active reader limit reached.');
      }
    }

    await runSql(`
      INSERT INTO profiles(username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, background_scene, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        background_scene = excluded.background_scene,
        is_active = excluded.is_active,
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
      profile.backgroundScene,
      profile.isActive ? 1 : 0,
      now,
    ]);

    await execSql('COMMIT');

    const row = await getSql<any>(`
      SELECT username, current_book, current_author, current_page, total_page_count, progress_mode, books_data, current_book_index, favorite_authors, status, position_x, position_y, avatar_icon, background_scene, is_active
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
    SET is_active = 0, updated_at = ?
    WHERE is_active = 1
  `, [now]);
}

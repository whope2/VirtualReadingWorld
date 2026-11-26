import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';

dotenv.config();

const { ensureSchema, getProfile, createProfile, updateProfile, listProfiles, listAllProfiles, getActiveProfileCount, getActiveReaderLimit, setActiveReaderLimit, resetActiveReaders, listDailyBulletinPosts, createDailyBulletinPost, setDailyBulletinPostLike, deleteDailyBulletinPost, deleteDailyBulletinPostByAuthor, resetDailyBulletinBoard, getDailyVisitStats, recordDailyVisit, getTopDailyReaders, recordLoginStreak, enterGhostMode, reactivateFromGhost, listChatMessages, listTodayChatReaders, createChatMessage, deleteChatMessageByAuthor, deleteChatMessage, setChatMessageLike, setProfileStatusLike, createChatPing, listChatPings, clearChatPings, maintainChatRetention, dbType } = require('./db') as typeof import('./db');

export const app = express();
const port = Number(process.env.PORT || 4000);
const OBSERVER_INACTIVITY_MS = 45_000;
const observerActivity = new Map<string, number>();
const announcementFilePath = process.env.ANNOUNCEMENT_FILE
  ? path.resolve(process.cwd(), process.env.ANNOUNCEMENT_FILE)
  : path.join(process.cwd(), 'data', 'announcement.txt');

type BookFormat = 'physical' | 'ebook' | 'audiobook';

type ProfileBookPayload = {
  title: string;
  author: string;
  imageData?: string;
  feeling?: string;
  feelingLikeCount?: number;
  currentProgress: number;
  totalProgress: number;
  currentRating: number;
  likeCount: number;
  format: BookFormat;
  progressMode: 'pages' | 'audio';
};

const PROFILE_BOOK_SLOT_COUNT = 4;
const BETWEEN_BOOKS_INDEX = 4;
const BETWEEN_BOOKS_TITLE = 'Between books';

function betweenBooksEntry(): ProfileBookPayload {
  return {
    title: BETWEEN_BOOKS_TITLE,
    author: '',
    imageData: '',
    feeling: '',
    currentProgress: 0,
    totalProgress: 0,
    currentRating: 0,
    likeCount: 0,
    format: 'physical',
    progressMode: 'pages',
  };
}

function normalizeRating(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  const clamped = Math.min(5, Math.max(0, parsed));
  return Math.round(clamped * 2) / 2;
}

function normalizeLikeCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function normalizeAboutMeLink(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href.slice(0, 500) : '';
  } catch {
    return '';
  }
}

function normalizeBookFormat(value: unknown): BookFormat {
  if (value === 'ebook' || value === 'audiobook') {
    return value;
  }
  return 'physical';
}

function clampBookIndex(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(BETWEEN_BOOKS_INDEX, Math.max(0, Math.floor(parsed)));
}

function isLoopbackAddress(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
}

function isLocalAdminRequest(req: express.Request): boolean {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return false;
  }
  if (Array.isArray(forwardedFor) && forwardedFor.some((entry) => entry.trim())) {
    return false;
  }

  const remoteAddress = req.socket?.remoteAddress;
  const ip = req.ip;
  return isLoopbackAddress(remoteAddress) || isLoopbackAddress(ip);
}

function requireLocalAdmin(req: express.Request, res: express.Response): boolean {
  if (isLocalAdminRequest(req)) {
    return true;
  }
  res.status(403).json({ error: 'Admin endpoint is only available from localhost.' });
  return false;
}

function pruneInactiveObservers(now = Date.now()) {
  for (const [username, lastSeen] of observerActivity.entries()) {
    if (now - lastSeen > OBSERVER_INACTIVITY_MS) {
      observerActivity.delete(username);
    }
  }
}

async function readAnnouncementMessage(): Promise<string> {
  try {
    const content = await fs.readFile(announcementFilePath, 'utf8');
    return content.trim();
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;
    if (fsError?.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

async function handleStatusLike(req: express.Request, res: express.Response, delta: 1 | -1) {
  const username = String(req.params.username || '').trim();
  const status = typeof req.body?.status === 'string' ? req.body.status : null;

  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }
  if (status === null) {
    return res.status(400).json({ error: 'status is required' });
  }

  try {
    const result = await setProfileStatusLike(username, status, delta);
    if (!result) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    return res.json({ username, ...result });
  } catch (error) {
    console.error('status-like error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

app.get('/api/profile/:username', async (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  try {
    let profile = await getProfile(username);
    if (!profile) {
      const activeCount = await getActiveProfileCount();
      const limit = await getActiveReaderLimit();
      if (activeCount >= limit) {
        return res.status(403).json({ error: 'Active reader limit reached.' });
      }
      profile = await createProfile(username);
    }

    let shouldRecordDailyVisit = false;
    const hasLoginTimestamp = Number.isFinite(Number(profile.loginTimeUtc)) && Number(profile.loginTimeUtc) > 0;

    if (profile.isGhost) {
      profile = await reactivateFromGhost(profile.username) ?? profile;
      shouldRecordDailyVisit = true;
    } else if (!profile.isActive) {
      const activeCount = await getActiveProfileCount();
      const limit = await getActiveReaderLimit();
      if (activeCount >= limit) {
        return res.status(403).json({ error: 'Active reader limit reached.' });
      }
      profile = await updateProfile({
        ...profile,
        isActive: true,
        loginTimeUtc: Date.now(),
      }, true);
      shouldRecordDailyVisit = true;
    } else if (!hasLoginTimestamp) {
      profile = await updateProfile({
        ...profile,
        isActive: true,
        loginTimeUtc: Date.now(),
      }, true);
      shouldRecordDailyVisit = true;
    }

    if (shouldRecordDailyVisit) {
      try {
        await recordDailyVisit(profile.username);
      } catch (error) {
        console.warn('Unable to record daily visit during profile login', error);
      }
    }

    let dayStreak = 0;
    try {
      dayStreak = await recordLoginStreak(profile.username);
    } catch (error) {
      console.warn('Unable to record login streak', error);
    }

    return res.json({ ...profile, dayStreak });
  } catch (error) {
    console.error('GET /api/profile error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/profile/:username', async (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  const { books, currentBookIndex, currentBook, currentAuthor, currentPage, totalPageCount, progressMode, favoriteAuthors, status, aboutMeBio, aboutMeLink, booksRead, readingGoal, positionX, positionY, avatarIcon, avatarImageData, backgroundScene, isActive, loginTimeUtc } = req.body ?? {};

  for (const value of [booksRead, readingGoal]) {
    if (value !== undefined && value !== null && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)) {
      return res.status(400).json({ error: 'Reading counts must be non-negative whole numbers or null.' });
    }
  }

  try {
    let profile = await getProfile(username);
    if (!profile) {
      profile = await createProfile(username);
    }

    // Any client update from a ghost reader means they are back.
    if (profile.isGhost && isActive !== false) {
      profile = await reactivateFromGhost(username) ?? profile;
    }

    const parsedPage = currentPage !== undefined ? Number(currentPage) : profile.currentPage;
    const parsedTotalPageCount = totalPageCount !== undefined ? Number(totalPageCount) : profile.totalPageCount ?? 0;
    if (Number.isNaN(parsedPage) || parsedPage < 0) {
      return res.status(400).json({ error: 'currentPage must be a non-negative number' });
    }
    if (Number.isNaN(parsedTotalPageCount) || parsedTotalPageCount < 0) {
      return res.status(400).json({ error: 'totalPageCount must be a non-negative number' });
    }

    const authors = Array.isArray(favoriteAuthors)
      ? favoriteAuthors
      : typeof favoriteAuthors === 'string'
      ? favoriteAuthors.split(',').map((author: string) => author.trim()).filter(Boolean)
      : profile.favoriteAuthors;

    const parsedPositionX = positionX !== undefined ? Number(positionX) : profile.positionX;
    const parsedPositionY = positionY !== undefined ? Number(positionY) : profile.positionY;
    const parsedAvatarIcon = typeof avatarIcon === 'string' && avatarIcon.trim() ? avatarIcon : profile.avatarIcon;
    const parsedAvatarImageData = typeof avatarImageData === 'string' ? avatarImageData : profile.avatarImageData || '';
    const parsedBackgroundScene = typeof backgroundScene === 'string' && backgroundScene.trim()
      ? (['sunrise', 'ocean-beach', 'lush-forest', 'mountain-range', 'lake', 'library', 'rain'].includes(backgroundScene) ? backgroundScene : profile.backgroundScene)
      : profile.backgroundScene;
    const parsedProgressMode = progressMode === 'audio' || progressMode === 'pages'
      ? progressMode
      : (profile.progressMode || 'pages');
    const parsedCurrentBookIndex = currentBookIndex !== undefined
      ? clampBookIndex(currentBookIndex)
      : clampBookIndex(profile.currentBookIndex);

    const normalizedBooks: ProfileBookPayload[] = Array.from({ length: PROFILE_BOOK_SLOT_COUNT }, (_unused, index) => {
      const incomingBook = Array.isArray(books) ? books[index] : undefined;
      const existingBook = profile.books?.[index] ?? {
        title: index === 0 ? profile.currentBook : '',
        author: index === 0 ? profile.currentAuthor : '',
        imageData: '',
        feeling: '',
        currentProgress: index === 0 ? profile.currentPage : 0,
        totalProgress: index === 0 ? profile.totalPageCount : 0,
        likeCount: 0,
        format: index === 0 && profile.progressMode === 'audio' ? 'audiobook' : 'physical',
        progressMode: index === 0 ? profile.progressMode : 'pages',
      };

      const rawFormat = incomingBook?.format ?? existingBook.format;
      const format = normalizeBookFormat(rawFormat);
      const derivedProgressMode = format === 'audiobook' ? 'audio' : 'pages';

      const rawCurrent = incomingBook?.currentProgress ?? existingBook.currentProgress;
      const rawTotal = incomingBook?.totalProgress ?? existingBook.totalProgress;
      const rawRating = incomingBook?.currentRating ?? existingBook.currentRating ?? 0;
      const safeCurrent = Number(rawCurrent);
      const safeTotal = Number(rawTotal);
      const normalizedTitle = typeof incomingBook?.title === 'string' ? incomingBook.title : existingBook.title;
      const existingTitle = typeof existingBook.title === 'string' ? existingBook.title : '';
      const titleChanged = normalizedTitle.trim() !== existingTitle.trim();
      const feeling = typeof incomingBook?.feeling === 'string'
        ? incomingBook.feeling.replace(/[\r\n]+/g, ' ').slice(0, 160)
        : typeof existingBook.feeling === 'string' ? existingBook.feeling.slice(0, 160) : '';

      return {
        title: normalizedTitle,
        author: typeof incomingBook?.author === 'string' ? incomingBook.author : existingBook.author,
        imageData: typeof incomingBook?.imageData === 'string' ? incomingBook.imageData : ('imageData' in existingBook ? existingBook.imageData : ''),
        feeling,
        feelingLikeCount: titleChanged || feeling !== (existingBook.feeling || '') ? 0 : normalizeLikeCount(existingBook.feelingLikeCount),
        currentProgress: Number.isFinite(safeCurrent) && safeCurrent >= 0 ? Math.floor(safeCurrent) : 0,
        totalProgress: Number.isFinite(safeTotal) && safeTotal >= 0 ? Math.floor(safeTotal) : 0,
        currentRating: normalizeRating(rawRating),
        likeCount: titleChanged ? 0 : normalizeLikeCount(existingBook.likeCount),
        format,
        progressMode: derivedProgressMode,
      };
    });

    const selectedBook = parsedCurrentBookIndex === BETWEEN_BOOKS_INDEX
      ? betweenBooksEntry()
      : normalizedBooks[parsedCurrentBookIndex] ?? normalizedBooks[0];
    const parsedIsActive = typeof isActive === 'boolean' ? isActive : profile.isActive;
    const parsedStatus = typeof status === 'string' && status.trim() ? status : profile.status || 'Reading';
    const parsedLoginTimeUtc = loginTimeUtc !== undefined ? Number(loginTimeUtc) : profile.loginTimeUtc ?? 0;
    const finalLoginTimeUtc = parsedIsActive
      ? (Number.isFinite(parsedLoginTimeUtc) && parsedLoginTimeUtc > 0 ? parsedLoginTimeUtc : Date.now())
      : 0;

    const updatedProfile = await updateProfile({
      username,
      currentBook: typeof currentBook === 'string' ? currentBook : selectedBook.title,
      currentAuthor: typeof currentAuthor === 'string' ? currentAuthor : selectedBook.author,
      currentPage: currentPage !== undefined ? parsedPage : selectedBook.currentProgress,
      totalPageCount: totalPageCount !== undefined ? parsedTotalPageCount : selectedBook.totalProgress,
      progressMode: progressMode !== undefined ? parsedProgressMode : selectedBook.progressMode,
      currentBookIndex: parsedCurrentBookIndex,
      books: normalizedBooks,
      favoriteAuthors: authors,
      status: parsedStatus,
      aboutMeBio: typeof aboutMeBio === 'string' ? aboutMeBio.trim().slice(0, 280) : profile.aboutMeBio,
      aboutMeLink: aboutMeLink !== undefined ? normalizeAboutMeLink(aboutMeLink) : profile.aboutMeLink,
      booksRead: booksRead !== undefined ? booksRead : profile.booksRead,
      readingGoal: readingGoal !== undefined ? readingGoal : profile.readingGoal,
      positionX: Number.isNaN(parsedPositionX) ? profile.positionX : parsedPositionX,
      positionY: Number.isNaN(parsedPositionY) ? profile.positionY : parsedPositionY,
      avatarIcon: parsedAvatarIcon,
      avatarImageData: parsedAvatarImageData,
      backgroundScene: parsedBackgroundScene,
      isActive: parsedIsActive,
      loginTimeUtc: finalLoginTimeUtc,
      isGhost: profile.isGhost,
      statusLikeCount: profile.statusLikeCount,
      recentStatuses: profile.recentStatuses,
    }, true);

    return res.json(updatedProfile);
  } catch (error) {
    console.error('PUT /api/profile error', error);
    if (error instanceof Error && error.message === 'Active reader limit reached.') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/profile/:username/deactivate', async (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  try {
    const profile = await getProfile(username);
    if (!profile) {
      return res.json({ success: true, isActive: false });
    }

    const updatedProfile = await enterGhostMode(username);

    return res.json({ success: true, isActive: updatedProfile?.isActive ?? false, isGhost: updatedProfile?.isGhost ?? false });
  } catch (error) {
    console.error('POST /api/profile/:username/deactivate error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/profile/:username/status-like', async (req, res) => {
  await handleStatusLike(req, res, 1);
});

app.delete('/api/profile/:username/status-like', async (req, res) => {
  await handleStatusLike(req, res, -1);
});

async function handleFeelingLike(req: express.Request, res: express.Response, delta: 1 | -1) {
  const username = String(req.params.username || '').trim();
  const bookIndex = Number(req.params.bookIndex);
  const feeling = req.body?.feeling;
  const title = req.body?.title;
  if (!username || !Number.isInteger(bookIndex) || bookIndex < 0 || bookIndex >= PROFILE_BOOK_SLOT_COUNT
    || typeof feeling !== 'string' || !feeling.trim() || typeof title !== 'string') {
    return res.status(400).json({ error: 'A valid username, book index, title, and feeling are required.' });
  }

  try {
    const profile = await getProfile(username);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    const book = profile.books[bookIndex];
    if (!book || book.feeling !== feeling || book.title.trim() !== title.trim()) {
      return res.status(409).json({ error: 'This feeling has changed. Please try again.' });
    }
    const books = profile.books.map((entry, index) => index === bookIndex
      ? { ...entry, feelingLikeCount: Math.max(0, normalizeLikeCount(entry.feelingLikeCount) + delta) }
      : entry);
    const updatedProfile = await updateProfile({ ...profile, books }, false);
    return res.json({ username, bookIndex, feelingLikeCount: updatedProfile.books[bookIndex].feelingLikeCount, profile: updatedProfile });
  } catch (error) {
    console.error('Feeling like error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

app.post('/api/profile/:username/books/:bookIndex/feeling-like', (req, res) => handleFeelingLike(req, res, 1));
app.delete('/api/profile/:username/books/:bookIndex/feeling-like', (req, res) => handleFeelingLike(req, res, -1));

app.post('/api/profile/:username/books/:bookIndex/like', async (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  const parsedBookIndex = Number(req.params.bookIndex);
  if (!Number.isInteger(parsedBookIndex) || parsedBookIndex < 0 || parsedBookIndex >= PROFILE_BOOK_SLOT_COUNT) {
    return res.status(400).json({ error: 'bookIndex must be between 0 and 3' });
  }

  try {
    const profile = await getProfile(username);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    const nextBooks: ProfileBookPayload[] = Array.from({ length: PROFILE_BOOK_SLOT_COUNT }, (_unused, index) => {
      const source = profile.books?.[index] ?? {
        title: index === 0 ? profile.currentBook : '',
        author: index === 0 ? profile.currentAuthor : '',
        imageData: '',
        feeling: '',
        currentProgress: index === 0 ? profile.currentPage : 0,
        totalProgress: index === 0 ? profile.totalPageCount : 0,
        currentRating: 0,
        likeCount: 0,
        format: index === 0 && profile.progressMode === 'audio' ? 'audiobook' : 'physical',
        progressMode: index === 0 ? profile.progressMode : 'pages',
      };

      return {
        ...source,
        likeCount: index === parsedBookIndex ? normalizeLikeCount(source.likeCount) + 1 : normalizeLikeCount(source.likeCount),
      };
    });

    const selectedBook = profile.currentBookIndex === BETWEEN_BOOKS_INDEX
      ? betweenBooksEntry()
      : nextBooks[profile.currentBookIndex] ?? nextBooks[0];
    const updatedProfile = await updateProfile({
      ...profile,
      books: nextBooks,
      currentBook: selectedBook?.title ?? profile.currentBook,
      currentAuthor: selectedBook?.author ?? profile.currentAuthor,
      currentPage: selectedBook?.currentProgress ?? profile.currentPage,
      totalPageCount: selectedBook?.totalProgress ?? profile.totalPageCount,
      progressMode: selectedBook?.progressMode ?? profile.progressMode,
    }, false);

    const updatedBook = updatedProfile.books?.[parsedBookIndex];
    return res.json({
      username,
      bookIndex: parsedBookIndex,
      likeCount: normalizeLikeCount(updatedBook?.likeCount),
      profile: updatedProfile,
    });
  } catch (error) {
    console.error('POST /api/profile/:username/books/:bookIndex/like error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/profile/:username/books/:bookIndex/like', async (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  const parsedBookIndex = Number(req.params.bookIndex);
  if (!Number.isInteger(parsedBookIndex) || parsedBookIndex < 0 || parsedBookIndex >= PROFILE_BOOK_SLOT_COUNT) {
    return res.status(400).json({ error: 'bookIndex must be between 0 and 3' });
  }

  try {
    const profile = await getProfile(username);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    const nextBooks: ProfileBookPayload[] = Array.from({ length: PROFILE_BOOK_SLOT_COUNT }, (_unused, index) => {
      const source = profile.books?.[index] ?? {
        title: index === 0 ? profile.currentBook : '',
        author: index === 0 ? profile.currentAuthor : '',
        imageData: '',
        feeling: '',
        currentProgress: index === 0 ? profile.currentPage : 0,
        totalProgress: index === 0 ? profile.totalPageCount : 0,
        currentRating: 0,
        likeCount: 0,
        format: index === 0 && profile.progressMode === 'audio' ? 'audiobook' : 'physical',
        progressMode: index === 0 ? profile.progressMode : 'pages',
      };

      const currentLikeCount = normalizeLikeCount(source.likeCount);
      return {
        ...source,
        likeCount: index === parsedBookIndex ? Math.max(0, currentLikeCount - 1) : currentLikeCount,
      };
    });

    const selectedBook = profile.currentBookIndex === BETWEEN_BOOKS_INDEX
      ? betweenBooksEntry()
      : nextBooks[profile.currentBookIndex] ?? nextBooks[0];
    const updatedProfile = await updateProfile({
      ...profile,
      books: nextBooks,
      currentBook: selectedBook?.title ?? profile.currentBook,
      currentAuthor: selectedBook?.author ?? profile.currentAuthor,
      currentPage: selectedBook?.currentProgress ?? profile.currentPage,
      totalPageCount: selectedBook?.totalProgress ?? profile.totalPageCount,
      progressMode: selectedBook?.progressMode ?? profile.progressMode,
    }, false);

    const updatedBook = updatedProfile.books?.[parsedBookIndex];
    return res.json({
      username,
      bookIndex: parsedBookIndex,
      likeCount: normalizeLikeCount(updatedBook?.likeCount),
      profile: updatedProfile,
    });
  } catch (error) {
    console.error('DELETE /api/profile/:username/books/:bookIndex/like error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/bulletin/posts', async (_req, res) => {
  try {
    const posts = await listDailyBulletinPosts();
    return res.json(posts);
  } catch (error) {
    console.error('GET /api/bulletin/posts error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/bulletin/posts', async (req, res) => {
  const author = String(req.body?.author || '').trim();
  const text = String(req.body?.text || '').trim();
  const avatarIcon = typeof req.body?.avatarIcon === 'string' ? req.body.avatarIcon : undefined;
  const avatarImageData = typeof req.body?.avatarImageData === 'string' ? req.body.avatarImageData : undefined;
  const imageData = typeof req.body?.imageData === 'string' ? req.body.imageData : undefined;

  if (!author) {
    return res.status(400).json({ error: 'author is required' });
  }
  if (!text && !imageData) {
    return res.status(400).json({ error: 'text or image is required' });
  }

  try {
    const post = await createDailyBulletinPost({ author, text, avatarIcon, avatarImageData, imageData });
    return res.status(201).json(post);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create post.';
    if (message.includes('required')) {
      return res.status(400).json({ error: message });
    }
    console.error('POST /api/bulletin/posts error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/bulletin/posts/:postId/like', async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId < 1) {
    return res.status(400).json({ error: 'postId must be a positive integer' });
  }

  try {
    const post = await setDailyBulletinPostLike(postId, 1);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    return res.json(post);
  } catch (error) {
    console.error('POST /api/bulletin/posts/:postId/like error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/bulletin/posts/:postId/like', async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId < 1) {
    return res.status(400).json({ error: 'postId must be a positive integer' });
  }

  try {
    const post = await setDailyBulletinPostLike(postId, -1);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    return res.json(post);
  } catch (error) {
    console.error('DELETE /api/bulletin/posts/:postId/like error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/admin/bulletin/posts/:postId', async (req, res) => {
  if (!requireLocalAdmin(req, res)) {
    return;
  }

  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId < 1) {
    return res.status(400).json({ error: 'postId must be a positive integer' });
  }

  try {
    const removed = await deleteDailyBulletinPost(postId);
    if (!removed) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    return res.json({ success: true, postId });
  } catch (error) {
    console.error('DELETE /api/admin/bulletin/posts/:postId error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/bulletin/posts/:postId', async (req, res) => {
  const postId = Number(req.params.postId);
  const author = String(req.body?.author || '').trim();

  if (!Number.isInteger(postId) || postId < 1) {
    return res.status(400).json({ error: 'postId must be a positive integer' });
  }
  if (!author) {
    return res.status(400).json({ error: 'author is required' });
  }

  try {
    const result = await deleteDailyBulletinPostByAuthor(postId, author);
    if (result === 'not-found') {
      return res.status(404).json({ error: 'Post not found.' });
    }
    if (result === 'forbidden') {
      return res.status(403).json({ error: 'Only the post author can delete this post.' });
    }
    return res.json({ success: true, postId });
  } catch (error) {
    console.error('DELETE /api/bulletin/posts/:postId error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/bulletin/reset', async (req, res) => {
  if (!requireLocalAdmin(req, res)) {
    return;
  }

  try {
    await resetDailyBulletinBoard();
    return res.json({ success: true });
  } catch (error) {
    console.error('POST /api/admin/bulletin/reset error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/chat/readers', async (_req, res) => {
  try {
    return res.json(await listTodayChatReaders());
  } catch (error) {
    console.error('GET /api/chat/readers error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/chat/messages', async (req, res) => {
  try {
    const day = typeof req.query.day === 'string' ? req.query.day : '';
    const after = Number(req.query.after ?? 0);
    const result = await listChatMessages(day, after);
    return res.json(result);
  } catch (error) {
    console.error('GET /api/chat/messages error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/chat/messages', async (req, res) => {
  const author = String(req.body?.author || '').trim();
  const text = String(req.body?.text || '').trim();
  const avatarIcon = typeof req.body?.avatarIcon === 'string' ? req.body.avatarIcon : undefined;
  const avatarImageData = typeof req.body?.avatarImageData === 'string' ? req.body.avatarImageData : undefined;
  const imageData = typeof req.body?.imageData === 'string' ? req.body.imageData : undefined;
  const toUsername = typeof req.body?.toUsername === 'string' ? req.body.toUsername : undefined;
  const toAvatarIcon = typeof req.body?.toAvatarIcon === 'string' ? req.body.toAvatarIcon : undefined;
  const toAvatarImageData = typeof req.body?.toAvatarImageData === 'string' ? req.body.toAvatarImageData : undefined;
  const bookTitle = typeof req.body?.bookTitle === 'string' ? req.body.bookTitle : undefined;

  if (!author) {
    return res.status(400).json({ error: 'author is required' });
  }
  if (!text && !imageData) {
    return res.status(400).json({ error: 'text or image is required' });
  }

  try {
    const message = await createChatMessage({ author, text, avatarIcon, avatarImageData, imageData, toUsername, toAvatarIcon, toAvatarImageData, bookTitle });
    return res.status(201).json(message);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send message.';
    if (message.includes('required')) {
      return res.status(400).json({ error: message });
    }
    console.error('POST /api/chat/messages error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/chat/messages/:messageId/like', async (req, res) => {
  const messageId = Number(req.params.messageId);
  if (!Number.isInteger(messageId) || messageId < 1) {
    return res.status(400).json({ error: 'messageId must be a positive integer' });
  }

  try {
    const message = await setChatMessageLike(messageId, 1);
    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }
    return res.json(message);
  } catch (error) {
    console.error('POST /api/chat/messages/:messageId/like error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/chat/messages/:messageId/like', async (req, res) => {
  const messageId = Number(req.params.messageId);
  if (!Number.isInteger(messageId) || messageId < 1) {
    return res.status(400).json({ error: 'messageId must be a positive integer' });
  }

  try {
    const message = await setChatMessageLike(messageId, -1);
    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }
    return res.json(message);
  } catch (error) {
    console.error('DELETE /api/chat/messages/:messageId/like error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/chat/messages/:messageId', async (req, res) => {
  const messageId = Number(req.params.messageId);
  const author = String(req.body?.author || '').trim();

  if (!Number.isInteger(messageId) || messageId < 1) {
    return res.status(400).json({ error: 'messageId must be a positive integer' });
  }
  if (!author) {
    return res.status(400).json({ error: 'author is required' });
  }

  try {
    const result = await deleteChatMessageByAuthor(messageId, author);
    if (result === 'not-found') {
      return res.status(404).json({ error: 'Message not found.' });
    }
    if (result === 'forbidden') {
      return res.status(403).json({ error: 'Only the author can delete this message.' });
    }
    return res.json({ success: true, messageId });
  } catch (error) {
    console.error('DELETE /api/chat/messages/:messageId error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/admin/chat/messages/:messageId', async (req, res) => {
  if (!requireLocalAdmin(req, res)) {
    return;
  }

  const messageId = Number(req.params.messageId);
  if (!Number.isInteger(messageId) || messageId < 1) {
    return res.status(400).json({ error: 'messageId must be a positive integer' });
  }

  try {
    const removed = await deleteChatMessage(messageId);
    if (!removed) {
      return res.status(404).json({ error: 'Message not found.' });
    }
    return res.json({ success: true, messageId });
  } catch (error) {
    console.error('DELETE /api/admin/chat/messages/:messageId error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/chat/pings', async (req, res) => {
  const from = String(req.body?.from || '').trim();
  const to = String(req.body?.to || '').trim();
  const bookTitle = typeof req.body?.bookTitle === 'string' ? req.body.bookTitle : '';

  if (!from || !to) {
    return res.status(400).json({ error: 'from and to are required' });
  }

  try {
    await createChatPing({ from, to, bookTitle });
    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('POST /api/chat/pings error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/chat/pings/:username', async (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  try {
    const pings = await listChatPings(username);
    return res.json({ count: pings.length, pings });
  } catch (error) {
    console.error('GET /api/chat/pings/:username error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/chat/pings/:username', async (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  try {
    await clearChatPings(username);
    return res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/chat/pings/:username error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/profiles', async (_req, res) => {
  try {
    const profiles = await listProfiles();
    return res.json(profiles);
  } catch (error) {
    console.error('GET /api/profiles error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/profiles/all', async (_req, res) => {
  try {
    const profiles = await listAllProfiles();
    return res.json(profiles);
  } catch (error) {
    console.error('GET /api/profiles/all error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/active-reader-limit', async (_req, res) => {
  try {
    const limit = await getActiveReaderLimit();
    return res.json({ limit });
  } catch (error) {
    console.error('GET /api/active-reader-limit error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/observers', (_req, res) => {
  pruneInactiveObservers();
  return res.json({ count: observerActivity.size });
});

app.post('/api/observers', (req, res) => {
  const username = String(req.body?.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  pruneInactiveObservers();
  observerActivity.set(username, Date.now());
  return res.json({ count: observerActivity.size });
});

app.delete('/api/observers/:username', (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  pruneInactiveObservers();
  observerActivity.delete(username);
  return res.json({ count: observerActivity.size });
});

app.post('/api/stats/visit', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  try {
    const stats = await recordDailyVisit(username);
    return res.status(201).json({
      dayKey: stats.dayKey,
      dailyVisits: stats.visitCount,
      dailyUsers: stats.userCount,
      totalReadingMinutes: stats.totalReadingMinutes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update visit stats.';
    if (message.includes('required')) {
      return res.status(400).json({ error: message });
    }
    console.error('POST /api/stats/visit error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/stats/daily', async (_req, res) => {
  try {
    pruneInactiveObservers();
    const activeReaders = await getActiveProfileCount();
    const [stats, limit, topReaders] = await Promise.all([
      getDailyVisitStats(),
      getActiveReaderLimit(),
      getTopDailyReaders(3),
    ]);

    return res.json({
      dayKey: stats.dayKey,
      dailyVisits: stats.visitCount,
      dailyUsers: stats.userCount,
      totalReadingMinutes: stats.totalReadingMinutes,
      activeReaders,
      activeReaderLimit: limit,
      observers: observerActivity.size,
      topReaders,
    });
  } catch (error) {
    console.error('GET /api/stats/daily error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/reset', async (_req, res) => {
  try {
    await resetActiveReaders();
    observerActivity.clear();
    return res.json({ success: true, observers: 0, activeReaders: 0 });
  } catch (error) {
    console.error('POST /api/reset error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/active-reader-limit', async (req, res) => {
  try {
    const incomingLimit = Number(req.body?.limit);
    const limit = await setActiveReaderLimit(incomingLimit);
    return res.json({ limit });
  } catch (error) {
    console.error('PUT /api/active-reader-limit error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/announcement', async (_req, res) => {
  try {
    const message = await readAnnouncementMessage();
    return res.json({
      message,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GET /api/announcement error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export async function start() {
  try {
    await ensureSchema();
    app.listen(port, () => {
      console.log(`Backend running on http://localhost:${port} using ${dbType}`);
    });

    // Keep bulletin board scoped to current ET day even during idle periods.
    setInterval(() => {
      void listDailyBulletinPosts().catch(() => undefined);
      void maintainChatRetention().catch(() => undefined);
    }, 5 * 60 * 1000);
  } catch (error) {
    console.error('Startup error', error);
    process.exit(1);
  }
}

if (require.main === module) {
  void start();
}

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';

dotenv.config();

const { ensureSchema, getProfile, createProfile, updateProfile, listProfiles, listAllProfiles, getActiveProfileCount, getActiveReaderLimit, setActiveReaderLimit, resetActiveReaders, dbType } = require('./db') as typeof import('./db');

const app = express();
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
  currentProgress: number;
  totalProgress: number;
  format: BookFormat;
  progressMode: 'pages' | 'audio';
};

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
  return Math.min(2, Math.max(0, Math.floor(parsed)));
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
app.use(express.json());

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

    if (!profile.isActive) {
      const activeCount = await getActiveProfileCount();
      const limit = await getActiveReaderLimit();
      if (activeCount >= limit) {
        return res.status(403).json({ error: 'Active reader limit reached.' });
      }
      profile = await updateProfile({
        ...profile,
        isActive: true,
      }, true);
    }

    return res.json(profile);
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

  const { books, currentBookIndex, currentBook, currentAuthor, currentPage, totalPageCount, progressMode, favoriteAuthors, status, positionX, positionY, avatarIcon, backgroundScene, isActive } = req.body ?? {};

  try {
    let profile = await getProfile(username);
    if (!profile) {
      profile = await createProfile(username);
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
    const parsedBackgroundScene = typeof backgroundScene === 'string' && backgroundScene.trim()
      ? (['ocean-beach', 'lush-forest', 'mountain-range', 'lake'].includes(backgroundScene) ? backgroundScene : profile.backgroundScene)
      : profile.backgroundScene;
    const parsedProgressMode = progressMode === 'audio' || progressMode === 'pages'
      ? progressMode
      : (profile.progressMode || 'pages');
    const parsedCurrentBookIndex = currentBookIndex !== undefined
      ? clampBookIndex(currentBookIndex)
      : clampBookIndex(profile.currentBookIndex);

    const normalizedBooks: ProfileBookPayload[] = Array.from({ length: 3 }, (_unused, index) => {
      const incomingBook = Array.isArray(books) ? books[index] : undefined;
      const existingBook = profile.books?.[index] ?? {
        title: index === 0 ? profile.currentBook : '',
        author: index === 0 ? profile.currentAuthor : '',
        currentProgress: index === 0 ? profile.currentPage : 0,
        totalProgress: index === 0 ? profile.totalPageCount : 0,
        format: index === 0 && profile.progressMode === 'audio' ? 'audiobook' : 'physical',
        progressMode: index === 0 ? profile.progressMode : 'pages',
      };

      const rawFormat = incomingBook?.format ?? existingBook.format;
      const format = normalizeBookFormat(rawFormat);
      const derivedProgressMode = format === 'audiobook' ? 'audio' : 'pages';

      const rawCurrent = incomingBook?.currentProgress ?? existingBook.currentProgress;
      const rawTotal = incomingBook?.totalProgress ?? existingBook.totalProgress;
      const safeCurrent = Number(rawCurrent);
      const safeTotal = Number(rawTotal);

      return {
        title: typeof incomingBook?.title === 'string' ? incomingBook.title : existingBook.title,
        author: typeof incomingBook?.author === 'string' ? incomingBook.author : existingBook.author,
        currentProgress: Number.isFinite(safeCurrent) && safeCurrent >= 0 ? Math.floor(safeCurrent) : 0,
        totalProgress: Number.isFinite(safeTotal) && safeTotal >= 0 ? Math.floor(safeTotal) : 0,
        format,
        progressMode: derivedProgressMode,
      };
    });

    const selectedBook = normalizedBooks[parsedCurrentBookIndex] ?? normalizedBooks[0];
    const parsedIsActive = typeof isActive === 'boolean' ? isActive : profile.isActive;
    const parsedStatus = typeof status === 'string' && status.trim() ? status : profile.status || 'Reading';

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
      positionX: Number.isNaN(parsedPositionX) ? profile.positionX : parsedPositionX,
      positionY: Number.isNaN(parsedPositionY) ? profile.positionY : parsedPositionY,
      avatarIcon: parsedAvatarIcon,
      backgroundScene: parsedBackgroundScene,
      isActive: parsedIsActive,
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

    const updatedProfile = await updateProfile({
      ...profile,
      isActive: false,
    }, false);

    return res.json({ success: true, isActive: updatedProfile.isActive });
  } catch (error) {
    console.error('POST /api/profile/:username/deactivate error', error);
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

async function start() {
  try {
    await ensureSchema();
    app.listen(port, () => {
      console.log(`Backend running on http://localhost:${port} using ${dbType}`);
    });
  } catch (error) {
    console.error('Startup error', error);
    process.exit(1);
  }
}

start();

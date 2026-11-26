import { useEffect, useRef, useState } from 'react';
import './App.css';

type Profile = {
  username: string;
  currentBook: string;
  currentAuthor: string;
  currentPage: number;
  totalPageCount: number;
  progressMode: 'pages' | 'audio';
  currentBookIndex: number;
  books: ProfileBook[];
  aboutMeBio?: string;
  aboutMeLink?: string;
  favoriteAuthors: string[];
  status: string;
  positionX: number;
  positionY: number;
  avatarIcon: string;
  avatarImageData?: string;
  backgroundScene?: string;
  isActive: boolean;
  loginTimeUtc?: number;
  isObserver?: boolean;
  dayStreak?: number;
  isGhost?: boolean;
  statusLikeCount?: number;
  recentStatuses?: string[];
};

type SceneReader = Profile;
type LoginMode = 'reader' | 'observer';

const AVATAR_SIZE = 48;
const DEFAULT_POSITION = { x: 50, y: 50 };
const DEFAULT_NORMALIZED_POSITION = { x: 0.5, y: 0.5 };
const POSITION_SCALE = 10000;
const BETWEEN_BOOKS_INDEX = 4;
const BOOK_SLOT_COUNT = 4;
const BETWEEN_BOOKS_TITLE = 'Between books';
const BOOK_SLOT_OPTIONS: Array<{ index: number; label: string }> = [
  { index: 0, label: 'Book 1' },
  { index: 1, label: 'Book 2' },
  { index: 2, label: 'Book 3' },
  { index: 3, label: 'Book 4' },
];
const AVATAR_OPTIONS = ['📚', '📗', '📒', '📕', '📙', '📓', '🧠', '🦉', '🐰', '🧶', '🗂️', '📜', '🪶', '☕', '🍵', '🐶', '🐱', '🕶️'];
const SCENE_OPTIONS: SceneOption[] = [
  {
    label: 'Ocean beach',
    shortLabel: 'Beach',
    value: 'ocean-beach',
    imagePath: 'ocean-beach.jpg',
    overlay: 'linear-gradient(135deg, rgba(10, 45, 74, 0.2), rgba(61, 152, 208, 0.2))',
  },
  {
    label: 'Sunrise',
    shortLabel: 'Sunrise',
    value: 'sunrise',
    imagePath: 'sunrise.jpeg',
    overlay: 'linear-gradient(135deg, rgba(120, 56, 14, 0.26), rgba(255, 170, 94, 0.22))',
  },
  {
    label: 'Night',
    shortLabel: 'Night',
    value: 'night',
    imagePath: 'night.jpg',
    overlay: 'linear-gradient(135deg, rgba(8, 16, 44, 0.4), rgba(34, 56, 96, 0.24))',
  },
  {
    label: 'Lush forest',
    shortLabel: 'Forest',
    value: 'lush-forest',
    imagePath: 'lush-forest.jpg',
    overlay: 'linear-gradient(135deg, rgba(17, 42, 34, 0.35), rgba(91, 139, 77, 0.3))',
    badge: '🔊',
  },
  {
    label: 'Mountain range',
    shortLabel: 'Mountain',
    value: 'mountain-range',
    imagePath: 'mountain-range.jpg',
    overlay: 'linear-gradient(135deg, rgba(20, 41, 69, 0.25), rgba(120, 132, 154, 0.2))',
  },
  {
    label: 'Lake',
    shortLabel: 'Lake',
    value: 'lake',
    imagePath: 'lake.jpeg',
    overlay: 'linear-gradient(135deg, rgba(12, 56, 74, 0.2), rgba(89, 151, 140, 0.22))',
  },
  {
    label: 'Library',
    shortLabel: 'Library',
    value: 'library',
    imagePath: 'library.jpg',
    overlay: 'linear-gradient(135deg, rgba(64, 42, 24, 0.26), rgba(132, 98, 62, 0.22))',
  },
  {
    label: 'Rain',
    shortLabel: 'Rain',
    value: 'rain',
    imagePath: 'rain.jpg',
    overlay: 'linear-gradient(135deg, rgba(12, 24, 42, 0.35), rgba(66, 88, 116, 0.25))',
    badge: '🔊',
  },
];
type ProgressMode = 'pages' | 'audio';
type BookFormat = 'physical' | 'ebook' | 'audiobook';

type ProfileBook = {
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
  progressMode: ProgressMode;
};

type ProfileBookDraft = {
  title: string;
  author: string;
  imageData: string;
  feeling: string;
  currentProgress: string;
  totalProgress: string;
  currentRating: number;
  format: BookFormat;
};

type TooltipPlacement = {
  vertical: 'top' | 'bottom';
  horizontal: 'left' | 'center' | 'right';
};

type AnnouncementPayload = {
  message?: string;
};

type DailyTopReader = {
  username?: string;
  minutes?: number;
};

type DailyStatsPayload = {
  dayKey?: string;
  dailyVisits?: number;
  dailyUsers?: number;
  totalReadingMinutes?: number;
  activeReaders?: number;
  activeReaderLimit?: number;
  observers?: number;
  topReaders?: DailyTopReader[];
};

type BulletinPost = {
  dayKey: string;
  postId: number;
  author: string;
  avatarIcon: string;
  avatarImageData: string;
  text: string;
  imageData: string;
  likeCount: number;
  createdAt: number;
};

type ChatMessage = {
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

type ChatTarget = {
  username: string;
  avatarIcon: string;
  avatarImageData: string;
  bookTitle: string;
};

type ChatReader = {
  username: string;
  avatarIcon: string;
  avatarImageData: string;
};

type ChatPing = {
  fromUsername: string;
  bookTitle: string;
  createdAt: number;
};

type SceneOption = {
  label: string;
  shortLabel: string;
  value: string;
  imagePath: string;
  overlay: string;
  icon?: string;
  badge?: string;
};

const OUTDOOR_SCENES = new Set(['sunrise', 'night', 'ocean-beach', 'lush-forest', 'mountain-range', 'lake', 'rain']);

const BOOK_FORMAT_OPTIONS: Array<{ value: BookFormat; label: string; emoji: string }> = [
  { value: 'physical', label: 'Physical book', emoji: '📖' },
  { value: 'ebook', label: 'Ebook', emoji: '📱' },
  { value: 'audiobook', label: 'Audiobook', emoji: '🎧' },
];

function progressModeForFormat(format: BookFormat): ProgressMode {
  return format === 'audiobook' ? 'audio' : 'pages';
}

function formatBadgeEmoji(format: BookFormat): string {
  return BOOK_FORMAT_OPTIONS.find((option) => option.value === format)?.emoji ?? '📖';
}

function isReaderBetweenBooks(reader: Pick<Profile, 'currentBookIndex' | 'currentBook'>): boolean {
  return reader.currentBookIndex === BETWEEN_BOOKS_INDEX
    || reader.currentBook.trim().toLowerCase() === BETWEEN_BOOKS_TITLE.toLowerCase();
}

function getTooltipPlacement(
  position: { x: number; y: number },
  sceneWidth: number,
): TooltipPlacement {
  const horizontalEdgeThreshold = 80;
  const topEdgeThreshold = 92;

  const nearTop = position.y < topEdgeThreshold;
  const nearLeft = position.x < horizontalEdgeThreshold;
  const nearRight = sceneWidth - (position.x + AVATAR_SIZE) < horizontalEdgeThreshold;

  return {
    vertical: nearTop ? 'bottom' : 'top',
    horizontal: nearLeft ? 'left' : nearRight ? 'right' : 'center',
  };
}

function tooltipPlacementClass(placement: TooltipPlacement): string {
  return `tooltip-${placement.vertical} tooltip-${placement.horizontal}`;
}

function announcementVariantForScene(sceneValue: string): 'banner' | 'board' {
  return OUTDOOR_SCENES.has(sceneValue) ? 'banner' : 'board';
}

function formatLocalAnnouncementDate(): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
}

function apiUrl(path: string) {
  if (typeof window === 'undefined') {
    return path;
  }

  // Keep API calls host-relative so they work across changing LAN IPs.
  return path;
}

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

type FullscreenSceneElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function clampPosition(value: number, max: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(Math.round(value), 0), Math.max(0, max));
}

function clampScenePosition(position: { x: number; y: number }, sceneWidth: number, sceneHeight: number) {
  const maxX = Math.max(0, sceneWidth - AVATAR_SIZE);
  const maxY = Math.max(0, sceneHeight - AVATAR_SIZE);
  return {
    x: clampPosition(position.x, maxX),
    y: clampPosition(position.y, maxY),
  };
}

function toNormalizedPosition(position: { x: number; y: number }, sceneWidth: number, sceneHeight: number) {
  const maxX = Math.max(0, sceneWidth - AVATAR_SIZE);
  const maxY = Math.max(0, sceneHeight - AVATAR_SIZE);
  return {
    x: clamp01(position.x / (maxX || 1)),
    y: clamp01(position.y / (maxY || 1)),
  };
}

function toRenderedPosition(normalizedX: number, normalizedY: number, sceneWidth: number, sceneHeight: number) {
  const maxX = Math.max(0, sceneWidth - AVATAR_SIZE);
  const maxY = Math.max(0, sceneHeight - AVATAR_SIZE);
  return {
    x: clampPosition(Math.round(clamp01(normalizedX) * maxX), maxX),
    y: clampPosition(Math.round(clamp01(normalizedY) * maxY), maxY),
  };
}

function toStoredPosition(position: { x: number; y: number }, sceneWidth: number, sceneHeight: number) {
  return toNormalizedPosition(position, sceneWidth, sceneHeight);
}

function parseStoredPosition(value: unknown, sceneWidth: number, sceneHeight: number) {
  if (typeof value === 'object' && value !== null) {
    const candidate = value as { x?: unknown; y?: unknown };
    const x = typeof candidate.x === 'number' ? candidate.x : Number(candidate.x);
    const y = typeof candidate.y === 'number' ? candidate.y : Number(candidate.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      if (Math.abs(x) <= 1 && Math.abs(y) <= 1) {
        return { x: clamp01(x), y: clamp01(y) };
      }
      return toStoredPosition({ x, y }, sceneWidth, sceneHeight);
    }
  }
  return DEFAULT_NORMALIZED_POSITION;
}

function normalizeIncomingPosition(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_NORMALIZED_POSITION.x;
  }
  if (parsed >= 0 && parsed <= 1) {
    return clamp01(parsed);
  }
  return clamp01(parsed / POSITION_SCALE);
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

function normalizeBulletinPost(value: unknown): BulletinPost | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const source = value as Record<string, unknown>;
  const postId = Number(source.postId);
  const createdAt = Number(source.createdAt);
  const dayKey = typeof source.dayKey === 'string' ? source.dayKey : '';
  const author = typeof source.author === 'string' ? source.author : '';
  const text = typeof source.text === 'string' ? source.text : '';
  const imageData = typeof source.imageData === 'string' ? source.imageData : '';
  if (!dayKey || !author || (!text && !imageData) || !Number.isFinite(postId) || postId < 1 || !Number.isFinite(createdAt) || createdAt <= 0) {
    return null;
  }
  return {
    dayKey,
    postId: Math.floor(postId),
    author,
    avatarIcon: typeof source.avatarIcon === 'string' && source.avatarIcon.trim() ? source.avatarIcon : '📚',
    avatarImageData: typeof source.avatarImageData === 'string' ? source.avatarImageData : '',
    text,
    imageData,
    likeCount: normalizeLikeCount(source.likeCount),
    createdAt: Math.floor(createdAt),
  };
}

function normalizeChatMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const source = value as Record<string, unknown>;
  const messageId = Number(source.messageId);
  const createdAt = Number(source.createdAt);
  const dayKey = typeof source.dayKey === 'string' ? source.dayKey : '';
  const author = typeof source.author === 'string' ? source.author : '';
  const text = typeof source.text === 'string' ? source.text : '';
  const imageData = typeof source.imageData === 'string' ? source.imageData : '';
  const toUsername = typeof source.toUsername === 'string' ? source.toUsername : '';
  if (!dayKey || !author || (!text && !imageData) || !Number.isFinite(messageId) || messageId < 1 || !Number.isFinite(createdAt) || createdAt <= 0) {
    return null;
  }
  return {
    dayKey,
    messageId: Math.floor(messageId),
    author,
    avatarIcon: typeof source.avatarIcon === 'string' && source.avatarIcon.trim() ? source.avatarIcon : '📚',
    avatarImageData: typeof source.avatarImageData === 'string' ? source.avatarImageData : '',
    text,
    imageData,
    createdAt: Math.floor(createdAt),
    toUsername,
    toAvatarIcon: toUsername && typeof source.toAvatarIcon === 'string' && source.toAvatarIcon.trim() ? source.toAvatarIcon : '📚',
    toAvatarImageData: toUsername && typeof source.toAvatarImageData === 'string' ? source.toAvatarImageData : '',
    bookTitle: toUsername && typeof source.bookTitle === 'string' ? source.bookTitle : '',
    likeCount: normalizeLikeCount(source.likeCount),
  };
}

function formatRelativeTime(timestamp: number, nowUtc: number): string {
  const diffMs = Math.max(0, nowUtc - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatRatingLabel(value: number): string {
  if (value <= 0) {
    return 'Not rated';
  }
  const fixed = Number(value).toFixed(1).replace(/\.0$/, '');
  return `${fixed} / 5`;
}

function renderRatingStars(rating: number): JSX.Element {
  const safeRating = normalizeRating(rating);
  return (
    <div className="rating-stars tooltip-rating-stars" aria-label={`Current rating ${formatRatingLabel(safeRating)}`} aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => {
        const starValue = index + 1;
        const partialFill = safeRating > index && safeRating < starValue;
        const fillPercent = partialFill ? ((safeRating - index) * 100) : 0;
        const filled = safeRating >= starValue;

        return (
          <span
            key={`tooltip-rating-star-${starValue}`}
            className={`rating-star ${filled ? 'rating-star-filled' : partialFill ? 'rating-star-half' : 'rating-star-empty'}`}
            style={partialFill ? { ['--fill-percent' as string]: `${fillPercent}%` } : undefined}
          >
            ★
          </span>
        );
      })}
    </div>
  );
}

function resizeImageDataUrl(
  file: File,
  options: {
    targetWidth?: number;
    targetHeight?: number;
    outputType?: 'image/png' | 'image/jpeg';
    quality?: number;
    backgroundColor?: string;
    horizontalAlign?: 'left' | 'center';
    padToBounds?: boolean;
  } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('Image could not be read.'));
        return;
      }

      const image = new Image();
      image.onload = () => {
        const targetWidth = Math.max(1, Math.round(options.targetWidth ?? 180));
        const targetHeight = Math.max(1, Math.round(options.targetHeight ?? 180));
        const scale = Math.min(targetWidth / image.width, targetHeight / image.height);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        const padded = options.padToBounds !== false;
        canvas.width = padded ? targetWidth : width;
        canvas.height = padded ? targetHeight : height;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(result);
          return;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        if (options.backgroundColor && padded) {
          context.fillStyle = options.backgroundColor;
          context.fillRect(0, 0, canvas.width, canvas.height);
        }

        const offsetX = padded
          ? (options.horizontalAlign === 'left' ? 0 : Math.round((targetWidth - width) / 2))
          : 0;
        const offsetY = padded ? Math.round((targetHeight - height) / 2) : 0;
        context.drawImage(image, offsetX, offsetY, width, height);

        const outputType = options.outputType ?? (file.type === 'image/png' ? 'image/png' : 'image/jpeg');
        const quality = Number.isFinite(options.quality) ? Math.min(1, Math.max(0.1, Number(options.quality))) : 0.82;
        resolve(canvas.toDataURL(outputType, quality));
      };
      image.onerror = () => reject(new Error('Image could not be processed.'));
      image.src = result;
    };
    reader.onerror = () => reject(new Error('Image could not be read.'));
    reader.readAsDataURL(file);
  });
}

function createObserverProfile(username: string): Profile {
  const books: ProfileBook[] = [
    { title: 'Observing', author: '—', currentProgress: 0, totalProgress: 0, currentRating: 0, likeCount: 0, format: 'physical', progressMode: 'pages' },
    { title: '', author: '', currentProgress: 0, totalProgress: 0, currentRating: 0, likeCount: 0, format: 'physical', progressMode: 'pages' },
    { title: '', author: '', currentProgress: 0, totalProgress: 0, currentRating: 0, likeCount: 0, format: 'physical', progressMode: 'pages' },
    { title: '', author: '', currentProgress: 0, totalProgress: 0, currentRating: 0, likeCount: 0, format: 'physical', progressMode: 'pages' },
  ];

  return {
    username,
    currentBook: 'Observing',
    currentAuthor: '—',
    currentPage: 0,
    totalPageCount: 0,
    progressMode: 'pages',
    currentBookIndex: 0,
    books,
    favoriteAuthors: [],
    status: 'observing',
    positionX: DEFAULT_NORMALIZED_POSITION.x,
    positionY: DEFAULT_NORMALIZED_POSITION.y,
    avatarIcon: '👀',
    backgroundScene: 'ocean-beach',
    isActive: true,
    isObserver: true,
  };
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

function normalizeIncomingBooks(profile: Partial<Profile>): { books: ProfileBook[]; currentBookIndex: number } {
  const fallbackBook: ProfileBook = {
    title: profile.currentBook || '',
    author: profile.currentAuthor || '',
    currentProgress: Math.max(0, Math.floor(Number(profile.currentPage ?? 0))),
    totalProgress: Math.max(0, Math.floor(Number(profile.totalPageCount ?? 0))),
    currentRating: 0,
    likeCount: 0,
    format: profile.progressMode === 'audio' ? 'audiobook' : 'physical',
    progressMode: profile.progressMode === 'audio' ? 'audio' : 'pages',
  };

  const sourceBooks = Array.isArray(profile.books) ? profile.books : [];
  const storedBookIndex = clampBookIndex(profile.currentBookIndex ?? 0);
  const legacyBetweenBooksSelection = storedBookIndex === BOOK_SLOT_COUNT - 1
    && (profile.currentBook?.trim().toLowerCase() === BETWEEN_BOOKS_TITLE.toLowerCase()
      || (typeof sourceBooks[BOOK_SLOT_COUNT - 1]?.title === 'string'
        && sourceBooks[BOOK_SLOT_COUNT - 1].title.trim().toLowerCase() === BETWEEN_BOOKS_TITLE.toLowerCase()));
  const books: ProfileBook[] = Array.from({ length: BOOK_SLOT_COUNT }, (_unused, index) => {
    const rawSource = sourceBooks[index];
    const fallback = index === 0 ? fallbackBook : createDefaultBook(index);
    const legacyBetweenBook = index === BOOK_SLOT_COUNT - 1
      && typeof rawSource?.title === 'string'
      && rawSource.title.trim().toLowerCase() === BETWEEN_BOOKS_TITLE.toLowerCase();
    const source = legacyBetweenBook ? undefined : rawSource;
    const format = normalizeBookFormat(source?.format ?? fallback.format);
    const progressMode = progressModeForFormat(format);
    const currentProgress = Number(source?.currentProgress ?? fallback.currentProgress ?? 0);
    const totalProgress = Number(source?.totalProgress ?? fallback.totalProgress ?? 0);
    const currentRating = normalizeRating(source?.currentRating ?? fallback.currentRating ?? 0);
    const likeCount = normalizeLikeCount(source?.likeCount ?? fallback.likeCount ?? 0);

    const normalizedBook: ProfileBook = {
      title: typeof source?.title === 'string' ? source.title : fallback.title,
      author: typeof source?.author === 'string' ? source.author : fallback.author,
      imageData: typeof source?.imageData === 'string' ? source.imageData : '',
      feeling: typeof source?.feeling === 'string' ? source.feeling.replace(/[\r\n]+/g, ' ').slice(0, 160) : '',
      feelingLikeCount: normalizeLikeCount(source?.feelingLikeCount ?? 0),
      currentProgress: Number.isFinite(currentProgress) && currentProgress >= 0 ? Math.floor(currentProgress) : 0,
      totalProgress: Number.isFinite(totalProgress) && totalProgress >= 0 ? Math.floor(totalProgress) : 0,
      currentRating,
      likeCount,
      format,
      progressMode,
    };

    return normalizedBook;
  });

  const currentBookIndex = legacyBetweenBooksSelection ? BETWEEN_BOOKS_INDEX : storedBookIndex;
  return { books, currentBookIndex };
}

function profileToBookDrafts(books: ProfileBook[]): ProfileBookDraft[] {
  return books.map((book) => ({
    title: book.title,
    author: book.author,
    imageData: book.imageData || '',
    feeling: book.feeling || '',
    format: book.format,
    currentRating: normalizeRating(book.currentRating ?? 0),
    currentProgress: formatProgressInput(book.currentProgress, progressModeForFormat(book.format)),
    totalProgress: formatProgressInput(book.totalProgress, progressModeForFormat(book.format)),
  }));
}

function parseDraftProgress(value: string, mode: ProgressMode): number | null {
  if (!value.trim()) {
    return 0;
  }
  return parseProgressValue(value, mode);
}

function formatReaderBadgeLabel(username: string, status: string | null | undefined) {
  const trimmedUsername = username?.trim() || 'Reader';
  const trimmedStatus = typeof status === 'string' ? status.trim() : '';
  return trimmedStatus ? `${trimmedUsername}: ${trimmedStatus}` : trimmedUsername;
}

function safeExternalUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function parseAudioDurationToMinutes(value: string): number | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
  if (!normalized) return null;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  if (!/^(\d+h)?(\d+m)?$/.test(normalized)) return null;

  const hourMatch = normalized.match(/(\d+)h/);
  const minuteMatch = normalized.match(/(\d+)m/);
  if (!hourMatch && !minuteMatch) return null;

  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  return hours * 60 + minutes;
}

function formatMinutesToDuration(value: number): string {
  const safe = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours > 0 && minutes > 0) return `${hours}h${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function parseProgressValue(value: string, mode: ProgressMode): number | null {
  if (mode === 'audio') {
    return parseAudioDurationToMinutes(value);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function formatProgressInput(value: number, mode: ProgressMode): string {
  if (mode === 'audio') return formatMinutesToDuration(value);
  return String(Math.max(0, Math.floor(Number(value) || 0)));
}

function formatProgressDisplay(current: number, total: number, mode: ProgressMode): string {
  if (mode === 'audio') {
    return `${formatMinutesToDuration(current)} / ${formatMinutesToDuration(total)}`;
  }
  return `${Math.max(0, Math.floor(current ?? 0))} / ${Math.max(0, Math.floor(total ?? 0))}`;
}

function formatProgressPercent(current: number | null | undefined, total: number | null | undefined): string | null {
  if (current == null || total == null) {
    return null;
  }
  const safeCurrent = Number(current);
  const safeTotal = Number(total);
  if (!Number.isFinite(safeCurrent) || !Number.isFinite(safeTotal) || safeTotal <= 0 || safeCurrent < 0) {
    return null;
  }
  return `${Math.min(100, Math.round((safeCurrent / safeTotal) * 100))}%`;
}

function progressLabel(mode: ProgressMode): string {
  return mode === 'audio' ? 'Time' : 'Page';
}

function normalizeLoginTime(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
}

function formatReadingDuration(loginTimeUtc: number | undefined, nowUtc: number): string {
  const safeLoginTimeUtc = normalizeLoginTime(loginTimeUtc);
  if (!safeLoginTimeUtc) {
    return '0m';
  }

  const elapsedMinutes = Math.max(0, Math.floor((nowUtc - safeLoginTimeUtc) / 60000));
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m`;
  }

  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`;
}

function buildBookLikeSessionKey(username: string, bookIndex: number, book: Partial<ProfileBook> | undefined): string {
  const title = typeof book?.title === 'string' ? book.title.trim() : '';
  const author = typeof book?.author === 'string' ? book.author.trim() : '';
  const currentProgress = Math.max(0, Math.floor(Number(book?.currentProgress ?? 0)));
  const totalProgress = Math.max(0, Math.floor(Number(book?.totalProgress ?? 0)));
  const progressMode = book?.progressMode === 'audio' ? 'audio' : 'pages';
  return `${username}::${bookIndex}::${title}::${author}::${progressMode}::${currentProgress}/${totalProgress}`;
}

function buildFeelingLikeSessionKey(username: string, bookIndex: number, book: ProfileBook | undefined): string {
  return JSON.stringify([username, bookIndex, book?.title.trim() || '', book?.feeling || '']);
}

function trimAudioBufferEdges(buffer: AudioBuffer, threshold = 0.008, edgePaddingSeconds = 0.02): AudioBuffer {
  if (buffer.numberOfChannels === 0 || buffer.length === 0) {
    return buffer;
  }

  const channelData = buffer.getChannelData(0);
  const channelLength = channelData.length;
  const edgePaddingFrames = Math.max(0, Math.floor(buffer.sampleRate * edgePaddingSeconds));

  let startIndex = 0;
  while (startIndex < channelLength && Math.abs(channelData[startIndex]) < threshold) {
    startIndex += 1;
  }

  let endIndex = channelLength - 1;
  while (endIndex > startIndex && Math.abs(channelData[endIndex]) < threshold) {
    endIndex -= 1;
  }

  if (startIndex === 0 && endIndex === channelLength - 1) {
    return buffer;
  }

  startIndex = Math.max(0, startIndex - edgePaddingFrames);
  endIndex = Math.min(channelLength - 1, endIndex + edgePaddingFrames);

  const trimmedLength = Math.max(1, endIndex - startIndex + 1);
  const trimmedBuffer = new AudioBuffer({
    length: trimmedLength,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });

  for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
    const sourceChannel = buffer.getChannelData(channelIndex);
    trimmedBuffer.getChannelData(channelIndex).set(sourceChannel.subarray(startIndex, endIndex + 1));
  }

  return trimmedBuffer;
}

function App() {
  const [username, setUsername] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState({
    books: profileToBookDrafts([createDefaultBook(0), createDefaultBook(1), createDefaultBook(2), createDefaultBook(3)]),
    editingBookIndex: 0,
    favoriteAuthors: '',
    backgroundScene: 'ocean-beach',
    aboutMeBio: '',
    aboutMeLink: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarPosition, setAvatarPosition] = useState(DEFAULT_POSITION);
  const [statusText, setStatusText] = useState('Reading');
  const [isRecentStatusListOpen, setIsRecentStatusListOpen] = useState(false);
  const [scenePreview, setScenePreview] = useState('ocean-beach');
  const [avatarIconDraft, setAvatarIconDraft] = useState('📚');
  const [avatarImageData, setAvatarImageData] = useState('');
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [hoveredReaderUsername, setHoveredReaderUsername] = useState<string | null>(null);
  const [pinnedReaderUsername, setPinnedReaderUsername] = useState<string | null>(null);
  const [tooltipBookSelection, setTooltipBookSelection] = useState<{ username: string; bookIndex: number; currentBookIndex: number } | null>(null);
  const [aboutMePopupUsername, setAboutMePopupUsername] = useState<string | null>(null);
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [otherReaders, setOtherReaders] = useState<SceneReader[]>([]);
  const [activeReaderLimit, setActiveReaderLimit] = useState(10);
  const [observerCount, setObserverCount] = useState(0);
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(true);
  const [dailyVisits, setDailyVisits] = useState(0);
  const [dailyUsers, setDailyUsers] = useState(0);
  const [totalReadingMinutes, setTotalReadingMinutes] = useState(0);
  const [topDailyReaders, setTopDailyReaders] = useState<DailyTopReader[]>([]);
  const [isProfileCollapsed, setIsProfileCollapsed] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>('reader');
  const [browserNow, setBrowserNow] = useState(Date.now());
  const [likedBookSessionKeys, setLikedBookSessionKeys] = useState<Set<string>>(new Set());
  const [pendingLikeKey, setPendingLikeKey] = useState<string | null>(null);
  const [likedFeelingSessionKeys, setLikedFeelingSessionKeys] = useState<Set<string>>(new Set());
  const [pendingFeelingLikeKey, setPendingFeelingLikeKey] = useState<string | null>(null);
  const [bulletinPosts, setBulletinPosts] = useState<BulletinPost[]>([]);
  const [bulletinDraft, setBulletinDraft] = useState('');
  const [bulletinImageDraft, setBulletinImageDraft] = useState('');
  const [isPostingBulletin, setIsPostingBulletin] = useState(false);
  const [isBulletinCollapsed, setIsBulletinCollapsed] = useState(false);
  const [expandedBulletinImage, setExpandedBulletinImage] = useState<string | null>(null);
  const [pendingBulletinLikeKey, setPendingBulletinLikeKey] = useState<string | null>(null);
  const [pendingBulletinDeleteKey, setPendingBulletinDeleteKey] = useState<string | null>(null);
  const [likedBulletinSessionKeys, setLikedBulletinSessionKeys] = useState<Set<string>>(new Set());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [todayChatReaders, setTodayChatReaders] = useState<ChatReader[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatTarget, setChatTarget] = useState<ChatTarget | null>(null);
  const [pendingChatDeleteId, setPendingChatDeleteId] = useState<number | null>(null);
  const [pendingChatLikeId, setPendingChatLikeId] = useState<number | null>(null);
  const [pendingStatusLikeKey, setPendingStatusLikeKey] = useState<string | null>(null);
  const [likedStatusSessionKeys, setLikedStatusSessionKeys] = useState<Set<string>>(new Set());
  const [myStatusLikeCount, setMyStatusLikeCount] = useState(0);
  const [mySceneBooks, setMySceneBooks] = useState<{ username: string; books: ProfileBook[] } | null>(null);
  const [likedChatSessionKeys, setLikedChatSessionKeys] = useState<Set<string>>(new Set());
  const [chatImageDraft, setChatImageDraft] = useState('');
  const [isPostingChat, setIsPostingChat] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [chatPings, setChatPings] = useState<ChatPing[]>([]);
  const chatBoardRef = useRef<HTMLElement>(null);
  const chatFeedRef = useRef<HTMLDivElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const chatDayKeyRef = useRef('');
  const chatLastIdRef = useRef(0);
  const chatStickToBottomRef = useRef(true);
  const [isForestSoundEnabled, setIsForestSoundEnabled] = useState(false);
  const [isRainSoundEnabled, setIsRainSoundEnabled] = useState(false);
  const [isSceneImmersive, setIsSceneImmersive] = useState(false);
  const [isSceneNativeFullscreen, setIsSceneNativeFullscreen] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const sceneSizeRef = useRef<{ width: number; height: number } | null>(null);
  const forestAudioContextRef = useRef<AudioContext | null>(null);
  const forestAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const forestAudioBufferRef = useRef<AudioBuffer | null>(null);
  const rainAudioContextRef = useRef<AudioContext | null>(null);
  const rainAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rainAudioBufferRef = useRef<AudioBuffer | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const profileFormRef = useRef(profileForm);
  const statusTextRef = useRef(statusText);
  const avatarIconDraftRef = useRef(avatarIconDraft);
  const avatarImageDataRef = useRef(avatarImageData);
  const pollVersionRef = useRef(0);
  const suppressProfileStateRef = useRef(false);
  const sessionVersionRef = useRef(0);
  const likeStorageKey = profile?.username ? `vwr-liked-books:${profile.username}` : null;
  const feelingLikeStorageKey = profile?.username ? `vwr-liked-feelings:${profile.username}` : null;
  const bulletinLikeStorageKey = profile?.username ? `vwr-liked-bulletin:${profile.username}` : null;
  const chatLikeStorageKey = profile?.username ? `vwr-liked-chat:${profile.username}` : null;
  const statusLikeStorageKey = profile?.username ? `vwr-liked-status:${profile.username}` : null;

  useEffect(() => {
    const storedName = localStorage.getItem('vwr-username');
    const storedMode = localStorage.getItem('vwr-login-mode') as LoginMode | null;
    const storedPosition = localStorage.getItem('vwr-avatar-position');

    if (storedMode) {
      setLoginMode(storedMode);
    }

    if (storedName) {
      const removedSessionKey = `vwr-removed:${storedName}`;
      if (typeof window !== 'undefined' && window.localStorage.getItem(removedSessionKey) === '1') {
        setUsername('');
        setProfile(null);
        setHoveredReaderUsername(null);
        localStorage.removeItem('vwr-username');
        localStorage.removeItem('vwr-login-mode');
        localStorage.removeItem('vwr-avatar-position');
        return;
      }

      setUsername(storedName);
      if (storedMode === 'observer') {
        void loadProfile(storedName).then((result) => {
          if (result.joined) {
            void registerDailyVisit(storedName);
            return;
          }

          if (result.reason === 'active-limit') {
            const observerProfile = createObserverProfile(storedName);
            setProfile(observerProfile);
            const { books, currentBookIndex } = normalizeIncomingBooks(observerProfile);
            setProfileForm({
              books: profileToBookDrafts(books),
              editingBookIndex: currentBookIndex,
              favoriteAuthors: observerProfile.favoriteAuthors.join(', '),
              backgroundScene: observerProfile.backgroundScene || 'ocean-beach',
              aboutMeBio: '',
              aboutMeLink: '',
            });
            setStatusText(observerProfile.status || 'Reading');
            setAvatarPosition(toRenderedPosition(observerProfile.positionX, observerProfile.positionY, sceneRef.current?.clientWidth ?? 640, sceneRef.current?.clientHeight ?? 520));
            localStorage.setItem('vwr-login-mode', 'observer');
            void loadOtherReaders(storedName);
            void loadObserverCount();
            void registerDailyVisit(storedName);
          }
        });
      } else {
        void loadProfile(storedName).then((result) => {
          if (result.joined) {
            void registerDailyVisit(storedName);
          }
        });
      }
    }

    if (storedPosition) {
      try {
        const parsedPosition = parseStoredPosition(JSON.parse(storedPosition), sceneRef.current?.clientWidth ?? 640, sceneRef.current?.clientHeight ?? 520);
        const renderedPosition = toRenderedPosition(parsedPosition.x, parsedPosition.y, sceneRef.current?.clientWidth ?? 640, sceneRef.current?.clientHeight ?? 520);
        setAvatarPosition(renderedPosition);
      } catch {
        setAvatarPosition(DEFAULT_POSITION);
      }
    }

  }, []);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!profile) {
      setPinnedReaderUsername(null);
      setHoveredReaderUsername(null);
      setChatMessages([]);
      setTodayChatReaders([]);
      setChatPings([]);
      setChatDraft('');
      setChatTarget(null);
      setChatImageDraft('');
      chatDayKeyRef.current = '';
      chatLastIdRef.current = 0;
      chatStickToBottomRef.current = true;
    }
  }, [profile]);

  useEffect(() => {
    if (!profile?.username || profile.isObserver) {
      setTodayChatReaders([]);
      return;
    }

    let active = true;
    const loadReaders = () => {
      fetch(apiUrl(`/api/chat/readers?ts=${Date.now()}`), { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error('Unable to load readers');
          return response.json();
        })
        .then((data: unknown) => {
          if (!active || !Array.isArray(data)) return;
          setTodayChatReaders(data.filter((reader): reader is ChatReader =>
            typeof reader?.username === 'string'
            && typeof reader?.avatarIcon === 'string'
            && typeof reader?.avatarImageData === 'string'
          ));
        })
        .catch(() => undefined);
    };
    loadReaders();
    const interval = window.setInterval(loadReaders, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [profile?.username, profile?.isObserver]);

  useEffect(() => {
    const feed = chatFeedRef.current;
    if (feed && chatStickToBottomRef.current) {
      feed.scrollTop = 0;
    }
  }, [chatMessages, isChatCollapsed]);

  useEffect(() => {
    profileFormRef.current = profileForm;
  }, [profileForm]);

  useEffect(() => {
    statusTextRef.current = statusText;
  }, [statusText]);

  useEffect(() => {
    avatarIconDraftRef.current = avatarIconDraft;
  }, [avatarIconDraft]);

  useEffect(() => {
    avatarImageDataRef.current = avatarImageData;
  }, [avatarImageData]);

  useEffect(() => {
    if (!profile?.username || profile.isObserver || !likeStorageKey) {
      setLikedBookSessionKeys(new Set());
      return;
    }

    const raw = window.sessionStorage.getItem(likeStorageKey);
    if (!raw) {
      setLikedBookSessionKeys(new Set());
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const next = new Set<string>();
        for (const entry of parsed) {
          if (typeof entry === 'string' && entry) {
            next.add(entry);
          }
        }
        setLikedBookSessionKeys(next);
        return;
      }
    } catch {
      // ignore malformed session storage payload
    }

    setLikedBookSessionKeys(new Set());
  }, [profile?.username, profile?.isObserver, likeStorageKey]);

  useEffect(() => {
    if (!profile?.username || profile.isObserver || !likeStorageKey) {
      return;
    }
    window.sessionStorage.setItem(likeStorageKey, JSON.stringify(Array.from(likedBookSessionKeys)));
  }, [likedBookSessionKeys, profile?.username, profile?.isObserver, likeStorageKey]);

  useEffect(() => {
    if (!feelingLikeStorageKey || profile?.isObserver) {
      setLikedFeelingSessionKeys(new Set());
      return;
    }
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(feelingLikeStorageKey) || '[]');
      setLikedFeelingSessionKeys(new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []));
    } catch {
      setLikedFeelingSessionKeys(new Set());
    }
  }, [feelingLikeStorageKey, profile?.isObserver]);

  useEffect(() => {
    if (feelingLikeStorageKey && !profile?.isObserver) {
      window.sessionStorage.setItem(feelingLikeStorageKey, JSON.stringify(Array.from(likedFeelingSessionKeys)));
    }
  }, [feelingLikeStorageKey, likedFeelingSessionKeys, profile?.isObserver]);

  useEffect(() => {
    if (!profile?.username || !bulletinLikeStorageKey) {
      setLikedBulletinSessionKeys(new Set());
      return;
    }

    const raw = window.sessionStorage.getItem(bulletinLikeStorageKey);
    if (!raw) {
      setLikedBulletinSessionKeys(new Set());
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const next = new Set<string>();
        for (const entry of parsed) {
          if (typeof entry === 'string' && entry) {
            next.add(entry);
          }
        }
        setLikedBulletinSessionKeys(next);
        return;
      }
    } catch {
      // ignore malformed payload
    }

    setLikedBulletinSessionKeys(new Set());
  }, [profile?.username, bulletinLikeStorageKey]);

  useEffect(() => {
    if (!profile?.username || !bulletinLikeStorageKey) {
      return;
    }
    window.sessionStorage.setItem(bulletinLikeStorageKey, JSON.stringify(Array.from(likedBulletinSessionKeys)));
  }, [likedBulletinSessionKeys, profile?.username, bulletinLikeStorageKey]);

  useEffect(() => {
    if (!profile?.username || !chatLikeStorageKey) {
      setLikedChatSessionKeys(new Set());
      return;
    }

    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(chatLikeStorageKey) || '[]');
      if (Array.isArray(parsed)) {
        setLikedChatSessionKeys(new Set(parsed.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry))));
        return;
      }
    } catch {
      // ignore malformed payload
    }

    setLikedChatSessionKeys(new Set());
  }, [profile?.username, chatLikeStorageKey]);

  useEffect(() => {
    if (!profile?.username || !chatLikeStorageKey) {
      return;
    }
    window.sessionStorage.setItem(chatLikeStorageKey, JSON.stringify(Array.from(likedChatSessionKeys)));
  }, [likedChatSessionKeys, profile?.username, chatLikeStorageKey]);

  useEffect(() => {
    if (!profile?.username || !statusLikeStorageKey) {
      setLikedStatusSessionKeys(new Set());
      return;
    }

    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(statusLikeStorageKey) || '[]');
      if (Array.isArray(parsed)) {
        setLikedStatusSessionKeys(new Set(parsed.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry))));
        return;
      }
    } catch {
      // ignore malformed payload
    }

    setLikedStatusSessionKeys(new Set());
  }, [profile?.username, statusLikeStorageKey]);

  useEffect(() => {
    if (!profile?.username || !statusLikeStorageKey) {
      return;
    }
    window.sessionStorage.setItem(statusLikeStorageKey, JSON.stringify(Array.from(likedStatusSessionKeys)));
  }, [likedStatusSessionKeys, profile?.username, statusLikeStorageKey]);

  useEffect(() => {
    if (profile) {
      const { books, currentBookIndex } = normalizeIncomingBooks(profile);
      setProfileForm((current) => ({
        ...current,
        books: profileToBookDrafts(books),
        editingBookIndex: currentBookIndex,
        favoriteAuthors: profile.favoriteAuthors.join(', '),
        backgroundScene: current.backgroundScene || profile.backgroundScene || 'ocean-beach',
        aboutMeBio: profile.aboutMeBio || '',
        aboutMeLink: profile.aboutMeLink || '',
      }));
      setStatusText(profile.status || 'Reading');
      setScenePreview(profile.backgroundScene || 'ocean-beach');
      setAvatarIconDraft((current) => current === '📚' ? (profile.avatarIcon || '📚') : current);
      setAvatarImageData(profile.avatarImageData || '');
      const nextPosition = toRenderedPosition(profile.positionX, profile.positionY, sceneRef.current?.clientWidth ?? 640, sceneRef.current?.clientHeight ?? 520);
      setAvatarPosition(nextPosition);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile || profile.isObserver) {
      return;
    }

    const removedSessionKey = `vwr-removed:${profile.username}`;
    if (typeof window !== 'undefined' && window.localStorage.getItem(removedSessionKey) === '1') {
      setProfile(null);
      setHoveredReaderUsername(null);
      setUsername('');
      localStorage.removeItem('vwr-username');
      localStorage.removeItem('vwr-login-mode');
      localStorage.removeItem('vwr-avatar-position');
      return;
    }
  }, [profile?.username, profile?.isObserver]);

  useEffect(() => {
    void loadActiveReaderLimit();
    void loadObserverCount();
    void loadDailyStats();

    const tick = () => setBrowserNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (profile) {
      refreshSceneData(profile.username);
      const interval = window.setInterval(() => {
        refreshSceneData(profile.username);
      }, 1000);
      return () => window.clearInterval(interval);
    }
  }, [profile?.username]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSceneData(profile.username);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [profile?.username]);

  useEffect(() => {
    let isActive = true;

    const loadAnnouncement = () => {
      fetch(apiUrl(`/api/announcement?ts=${Date.now()}`), { cache: 'no-store' })
        .then((res) => res.json())
        .then((data: AnnouncementPayload) => {
          if (!isActive) {
            return;
          }
          const nextMessage = typeof data?.message === 'string' ? data.message.trim() : '';
          setAnnouncementMessage(nextMessage);
        })
        .catch(() => {
          if (isActive) {
            setAnnouncementMessage('');
          }
        });
    };

    loadAnnouncement();
    const interval = window.setInterval(loadAnnouncement, 30000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!profile?.isObserver || !profile.username) {
      return;
    }

    void registerObserver(profile.username);
    const interval = window.setInterval(() => {
      void registerObserver(profile.username);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [profile?.username, profile?.isObserver]);

  useEffect(() => {
    const sceneWidth = sceneRef.current?.clientWidth ?? 640;
    const sceneHeight = sceneRef.current?.clientHeight ?? 520;
    const normalizedPosition = toStoredPosition(avatarPosition, sceneWidth, sceneHeight);
    localStorage.setItem('vwr-avatar-position', JSON.stringify(normalizedPosition));
  }, [avatarPosition]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }

    const updatePositionForSceneSize = (nextWidth: number, nextHeight: number) => {
      const safeNextWidth = Math.max(1, Math.round(nextWidth));
      const safeNextHeight = Math.max(1, Math.round(nextHeight));
      const previousSize = sceneSizeRef.current;

      if (!previousSize) {
        sceneSizeRef.current = { width: safeNextWidth, height: safeNextHeight };
        return;
      }

      if (previousSize.width === safeNextWidth && previousSize.height === safeNextHeight) {
        return;
      }

      setAvatarPosition((currentPosition) => {
        const normalized = toStoredPosition(currentPosition, previousSize.width, previousSize.height);
        const remappedPosition = toRenderedPosition(normalized.x, normalized.y, safeNextWidth, safeNextHeight);
        return remappedPosition;
      });

      sceneSizeRef.current = { width: safeNextWidth, height: safeNextHeight };
    };

    const initialWidth = scene.clientWidth || 640;
    const initialHeight = scene.clientHeight || 520;
    sceneSizeRef.current = { width: initialWidth, height: initialHeight };

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }
        updatePositionForSceneSize(entry.contentRect.width, entry.contentRect.height);
      });

      observer.observe(scene);
      return () => {
        observer.disconnect();
      };
    }

    const handleWindowResize = () => {
      updatePositionForSceneSize(scene.clientWidth || 640, scene.clientHeight || 520);
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [profile?.username]);

  useEffect(() => {
    if (profile || error) {
      setLoading(false);
    }
  }, [profile, error]);

  useEffect(() => {
    if (profile) {
      return;
    }

    setIsSceneImmersive(false);
    setIsSceneNativeFullscreen(false);
  }, [profile]);

  useEffect(() => {
    const fullscreenDocument = document as FullscreenDocument;

    const syncFullscreenState = () => {
      const sceneElement = sceneRef.current;
      const isNativeFullscreen = !!sceneElement
        && (document.fullscreenElement === sceneElement || fullscreenDocument.webkitFullscreenElement === sceneElement);

      setIsSceneNativeFullscreen(isNativeFullscreen);
      if (!isNativeFullscreen) {
        setIsSceneImmersive(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isSceneImmersive && !isSceneNativeFullscreen) {
        setIsSceneImmersive(false);
      }
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange' as keyof DocumentEventMap, syncFullscreenState as EventListener);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange' as keyof DocumentEventMap, syncFullscreenState as EventListener);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSceneImmersive, isSceneNativeFullscreen]);

  useEffect(() => {
    const isSceneExpanded = isSceneImmersive || isSceneNativeFullscreen;
    document.body.classList.toggle('scene-immersive-body', isSceneExpanded);

    return () => {
      document.body.classList.remove('scene-immersive-body');
    };
  }, [isSceneImmersive, isSceneNativeFullscreen]);

  useEffect(() => {
    if (!expandedBulletinImage) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpandedBulletinImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [expandedBulletinImage]);

  useEffect(() => {
    if (!profile) return;
    if (profile.isObserver) {
      const unregister = () => {
        void unregisterObserver(profile.username);
      };
      window.addEventListener('beforeunload', unregister);
      return () => {
        window.removeEventListener('beforeunload', unregister);
        unregister();
      };
    }

    return undefined;
  }, [profile?.username, profile?.isObserver]);

  useEffect(() => {
    if (!profile || profile.isObserver) {
      return undefined;
    }

    const deactivateOnUnload = () => {
      const endpoint = apiUrl(`/api/profile/${encodeURIComponent(profile.username)}/deactivate`);

      try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          const payload = new Blob(['{}'], { type: 'application/json' });
          navigator.sendBeacon(endpoint, payload);
          return;
        }

        void fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: '{}',
          keepalive: true,
        });
      } catch {
        // Ignore unload-time network failures; inactivity fallback still applies server-side.
      }
    };

    window.addEventListener('beforeunload', deactivateOnUnload);
    return () => {
      window.removeEventListener('beforeunload', deactivateOnUnload);
    };
  }, [profile?.username, profile?.isObserver]);

  const syncLoginTimestampIfNeeded = async (nextProfile: Profile | null) => {
    if (!nextProfile || nextProfile.isObserver) {
      return;
    }

    if (normalizeLoginTime(nextProfile.loginTimeUtc) > 0) {
      return;
    }

    const loginTimeUtc = Date.now();
    try {
      const response = await fetch(apiUrl(`/api/profile/${encodeURIComponent(nextProfile.username)}?ts=${Date.now()}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginTimeUtc,
          isActive: true,
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.loginTimeUtc !== undefined) {
        setProfile((current) => (current ? { ...current, loginTimeUtc: Number(data.loginTimeUtc) } : current));
      }
    } catch {
      // ignore login timestamp sync failures for now; the app still shows the active reader.
    }
  };

  const loadProfile = (name: string): Promise<{ joined: boolean; reason?: 'active-limit' | 'error'; error?: string }> => {
    const sessionVersion = ++sessionVersionRef.current;
    setLoading(true);
    setError('');

    return fetch(apiUrl(`/api/profile/${encodeURIComponent(name)}?ts=${Date.now()}`), { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || 'Unable to reach backend.');
        }
        return data;
      })
      .then((data) => {
        if (sessionVersion !== sessionVersionRef.current) {
          return { joined: false };
        }

        if (data?.error) {
          setError(data.error);
          return { joined: false, reason: 'error' as const, error: data.error };
        }

        if (data?.isActive === false) {
          const errorMessage = 'This reader has been removed or is no longer active.';
          setError(errorMessage);
          setProfile(null);
          setHoveredReaderUsername(null);
          setUsername('');
          localStorage.removeItem('vwr-username');
          localStorage.removeItem('vwr-login-mode');
          localStorage.removeItem('vwr-avatar-position');
          return { joined: false, reason: 'error' as const, error: errorMessage };
        }

        setError('');
        localStorage.setItem('vwr-login-mode', 'reader');
        const normalizedIncoming = normalizeIncomingBooks(data as Partial<Profile>);
        const selectedBook = normalizedIncoming.books[normalizedIncoming.currentBookIndex] ?? normalizedIncoming.books[0];
        const normalizedProfile = {
          ...data,
          books: normalizedIncoming.books,
          currentBookIndex: normalizedIncoming.currentBookIndex,
          currentBook: selectedBook?.title ?? data.currentBook,
          currentAuthor: selectedBook?.author ?? data.currentAuthor,
          currentPage: selectedBook?.currentProgress ?? data.currentPage,
          totalPageCount: selectedBook?.totalProgress ?? data.totalPageCount,
          progressMode: selectedBook?.progressMode ?? data.progressMode,
          isObserver: false,
        };
        setProfile((current) => (current ? { ...current, ...normalizedProfile, avatarIcon: data.avatarIcon || current.avatarIcon, avatarImageData: data.avatarImageData || current.avatarImageData || '' } : { ...normalizedProfile, avatarImageData: data.avatarImageData || '' }));
        setAvatarImageData(data.avatarImageData || '');
        if (normalizeLoginTime(data.loginTimeUtc) === 0) {
          void syncLoginTimestampIfNeeded(normalizedProfile);
        }
        if (data.positionX !== undefined && data.positionY !== undefined) {
          const normalizedX = normalizeIncomingPosition(data.positionX);
          const normalizedY = normalizeIncomingPosition(data.positionY);
          setAvatarPosition(toRenderedPosition(normalizedX, normalizedY, sceneRef.current?.clientWidth ?? 640, sceneRef.current?.clientHeight ?? 520));
        }
        return { joined: true };
      })
      .catch((error) => {
        if (sessionVersion === sessionVersionRef.current) {
          const errorMessage = error instanceof Error ? error.message : 'Unable to reach backend.';
          setError(errorMessage);
        }
        return {
          joined: false,
          reason: error instanceof Error && error.message.includes('Active reader limit') ? 'active-limit' as const : 'error' as const,
          error: error instanceof Error ? error.message : 'Unable to reach backend.',
        };
      })
      .finally(() => {
        if (sessionVersion === sessionVersionRef.current) {
          setLoading(false);
        }
      });
  };

  const loadActiveReaderLimit = () => {
    fetch(apiUrl(`/api/active-reader-limit?ts=${Date.now()}`), { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data?.limit === 'number' && Number.isFinite(data.limit) && data.limit > 0) {
          setActiveReaderLimit(data.limit);
        }
      })
      .catch(() => undefined);
  };

  const loadObserverCount = () => {
    fetch(apiUrl(`/api/observers?ts=${Date.now()}`), { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data?.count === 'number' && Number.isFinite(data.count) && data.count >= 0) {
          setObserverCount(data.count);
        }
      })
      .catch(() => undefined);
  };

  const loadDailyStats = () => {
    fetch(apiUrl(`/api/stats/daily?ts=${Date.now()}`), { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: DailyStatsPayload) => {
        if (typeof data?.dailyVisits === 'number' && Number.isFinite(data.dailyVisits) && data.dailyVisits >= 0) {
          setDailyVisits(Math.floor(data.dailyVisits));
        }
        if (typeof data?.dailyUsers === 'number' && Number.isFinite(data.dailyUsers) && data.dailyUsers >= 0) {
          setDailyUsers(Math.floor(data.dailyUsers));
        }
        if (typeof data?.totalReadingMinutes === 'number' && Number.isFinite(data.totalReadingMinutes) && data.totalReadingMinutes >= 0) {
          setTotalReadingMinutes(Math.floor(data.totalReadingMinutes));
        }
        if (typeof data?.activeReaderLimit === 'number' && Number.isFinite(data.activeReaderLimit) && data.activeReaderLimit > 0) {
          setActiveReaderLimit(Math.floor(data.activeReaderLimit));
        }
        if (typeof data?.observers === 'number' && Number.isFinite(data.observers) && data.observers >= 0) {
          setObserverCount(Math.floor(data.observers));
        }
        if (Array.isArray(data?.topReaders)) {
          setTopDailyReaders(data.topReaders.slice(0, 3));
        }
      })
      .catch(() => undefined);
  };

  const registerDailyVisit = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/stats/visit?ts=${Date.now()}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: trimmedName }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return;
      }

      if (typeof data?.dailyVisits === 'number' && Number.isFinite(data.dailyVisits) && data.dailyVisits >= 0) {
        setDailyVisits(Math.floor(data.dailyVisits));
      }
      if (typeof data?.dailyUsers === 'number' && Number.isFinite(data.dailyUsers) && data.dailyUsers >= 0) {
        setDailyUsers(Math.floor(data.dailyUsers));
      }
      if (typeof data?.totalReadingMinutes === 'number' && Number.isFinite(data.totalReadingMinutes) && data.totalReadingMinutes >= 0) {
        setTotalReadingMinutes(Math.floor(data.totalReadingMinutes));
      }
    } catch {
      // ignore analytics failures so login flow is unaffected
    }
  };

  const loadBulletinPosts = () => {
    fetch(apiUrl(`/api/bulletin/posts?ts=${Date.now()}`), { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          return;
        }
        const normalized = data
          .map((entry) => normalizeBulletinPost(entry))
          .filter((entry): entry is BulletinPost => Boolean(entry));
        setBulletinPosts(normalized);
      })
      .catch(() => undefined);
  };

  const loadChatMessages = () => {
    const requestDay = chatDayKeyRef.current;
    const requestAfter = chatLastIdRef.current;

    fetch(apiUrl(`/api/chat/messages?day=${encodeURIComponent(requestDay)}&after=${requestAfter}&ts=${Date.now()}`), { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!data || typeof data.dayKey !== 'string' || !Array.isArray(data.messages)) {
          return;
        }
        const incoming = (data.messages as unknown[])
          .map((entry) => normalizeChatMessage(entry))
          .filter((entry): entry is ChatMessage => Boolean(entry));

        if (data.dayKey !== chatDayKeyRef.current) {
          chatDayKeyRef.current = data.dayKey;
          chatLastIdRef.current = incoming.reduce((max, entry) => Math.max(max, entry.messageId), 0);
          setChatMessages(incoming);
          return;
        }

        if (incoming.length > 0) {
          chatLastIdRef.current = incoming.reduce((max, entry) => Math.max(max, entry.messageId), chatLastIdRef.current);
        }
        const liveIds = Array.isArray(data.messageIds) ? new Set<number>((data.messageIds as unknown[]).map((id) => Number(id))) : null;
        const likeCounts = data.likeCounts && typeof data.likeCounts === 'object' ? data.likeCounts as Record<string, unknown> : null;
        setChatMessages((current) => {
          const known = new Set(current.map((entry) => entry.messageId));
          const fresh = incoming.filter((entry) => !known.has(entry.messageId));
          const kept = liveIds ? current.filter((entry) => liveIds.has(entry.messageId)) : current;
          let countsChanged = false;
          const synced = likeCounts
            ? kept.map((entry) => {
              const latest = likeCounts[String(entry.messageId)];
              if (latest === undefined) {
                return entry;
              }
              const nextCount = normalizeLikeCount(latest);
              if (nextCount === entry.likeCount) {
                return entry;
              }
              countsChanged = true;
              return { ...entry, likeCount: nextCount };
            })
            : kept;
          if (fresh.length === 0 && kept.length === current.length && !countsChanged) {
            return current;
          }
          return [...synced, ...fresh].sort((a, b) => a.messageId - b.messageId);
        });
      })
      .catch(() => undefined);
  };

  const loadChatPings = (name: string) => {
    fetch(apiUrl(`/api/chat/pings/${encodeURIComponent(name)}?ts=${Date.now()}`), { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!data || !Array.isArray(data.pings)) {
          return;
        }
        const next: ChatPing[] = (data.pings as Array<Record<string, unknown>>)
          .filter((entry) => typeof entry?.fromUsername === 'string' && entry.fromUsername)
          .map((entry) => ({
            fromUsername: String(entry.fromUsername),
            bookTitle: typeof entry.bookTitle === 'string' ? entry.bookTitle : '',
            createdAt: Number(entry.createdAt) || 0,
          }));
        setChatPings((current) => (
          current.length === next.length && current.every((ping, index) => ping.fromUsername === next[index].fromUsername && ping.createdAt === next[index].createdAt)
            ? current
            : next
        ));
      })
      .catch(() => undefined);
  };

  const refreshSceneData = (usernameOverride?: string) => {
    void loadActiveReaderLimit();
    void loadObserverCount();
    void loadDailyStats();
    void loadBulletinPosts();

    const currentReader = profileRef.current;
    if (currentReader && !currentReader.isObserver) {
      void loadChatMessages();
      void loadChatPings(usernameOverride ?? currentReader.username);
    }

    const attempts = [0, 150, 400, 1000];
    attempts.forEach((delay, index) => {
      window.setTimeout(() => {
        void loadOtherReaders(usernameOverride ?? profileRef.current?.username ?? profile?.username);
      }, delay + index * 100);
    });
  };

  const registerObserver = async (name: string) => {
    try {
      const response = await fetch(apiUrl(`/api/observers?ts=${Date.now()}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: name }),
      });
      const data = await response.json().catch(() => null);
      if (data?.count !== undefined) {
        setObserverCount(data.count);
      }
    } catch {
      // ignore observer registration errors for now
    }
  };

  const unregisterObserver = async (name: string) => {
    try {
      const response = await fetch(apiUrl(`/api/observers/${encodeURIComponent(name)}?ts=${Date.now()}`), {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => null);
      if (data?.count !== undefined) {
        setObserverCount(data.count);
      }
    } catch {
      // ignore observer cleanup errors for now
    }
  };

  const loadOtherReaders = (activeUsernameOverride?: string) => {
    const activeUsername = activeUsernameOverride ?? profileRef.current?.username ?? profile?.username;
    const requestVersion = ++pollVersionRef.current;
    const sceneWidth = sceneRef.current?.clientWidth ?? 640;
    const sceneHeight = sceneRef.current?.clientHeight ?? 520;

    fetch(apiUrl(`/api/profiles?ts=${Date.now()}`), { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (requestVersion !== pollVersionRef.current) {
          return;
        }

        if (Array.isArray(data)) {
          // Own count is kept out of `profile` so a like never resets the editing form.
          const mine = data.find((item) => item.username === activeUsername);
          if (mine) {
            setMyStatusLikeCount(normalizeLikeCount(mine.statusLikeCount));
            setMySceneBooks({ username: mine.username, books: normalizeIncomingBooks(mine).books });
          }
          const normalized = data
            .filter((item) => item.username !== activeUsername)
            .map((item) => ({
              ...item,
              positionX: normalizeIncomingPosition(item.positionX),
              positionY: normalizeIncomingPosition(item.positionY),
            }));
          setOtherReaders(normalized.filter((reader) => reader.username));
        }
      })
      .catch(() => undefined);
  };

  const persistAvatarPosition = async (nextPosition: { x: number; y: number }) => {
    const currentProfile = profileRef.current ?? profile;
    if (!currentProfile || currentProfile.isObserver) {
      return null;
    }

    const sceneWidth = sceneRef.current?.clientWidth ?? 640;
    const sceneHeight = sceneRef.current?.clientHeight ?? 520;
    const normalizedPosition = toStoredPosition(nextPosition, sceneWidth, sceneHeight);

    try {
      const response = await fetch(apiUrl(`/api/profile/${encodeURIComponent(currentProfile.username)}?ts=${Date.now()}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          positionX: normalizedPosition.x,
          positionY: normalizedPosition.y,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Unable to update location.');
        return null;
      }

      if (data?.positionX !== undefined && data?.positionY !== undefined) {
        setProfile((current) => (current ? { ...current, positionX: normalizeIncomingPosition(data.positionX), positionY: normalizeIncomingPosition(data.positionY) } : current));
      }
      loadOtherReaders();
      return data;
    } catch {
      setError('Unable to update location.');
      return null;
    }
  };

  const persistProfile = async (
    overrides: Partial<Profile> = {},
    mode: 'all' | 'status' | 'books' | 'aboutMe' = 'all',
  ) => {
    const currentProfile = profileRef.current ?? profile;
    const currentProfileForm = profileFormRef.current;
    if (!currentProfile) return null;

    if (currentProfile.isObserver) {
      return null;
    }

    const removedSessionKey = `vwr-removed:${currentProfile.username}`;
    if (typeof window !== 'undefined' && window.localStorage.getItem(removedSessionKey) === '1') {
      setProfile(null);
      setHoveredReaderUsername(null);
      setUsername('');
      localStorage.removeItem('vwr-username');
      localStorage.removeItem('vwr-login-mode');
      localStorage.removeItem('vwr-avatar-position');
      return null;
    }

    const sessionVersion = sessionVersionRef.current;
    const shouldSendBooks = mode === 'all' || mode === 'books';
    const shouldSendStatus = mode === 'all' || mode === 'status';
    const shouldSendFullProfile = mode === 'all';
    const shouldSendAboutMe = mode === 'all' || mode === 'aboutMe';

    const normalizedBooks: ProfileBook[] = [];
    let safeCurrentBookIndex = clampBookIndex(currentProfileForm.editingBookIndex);
    let selectedBook = currentProfile.books?.[safeCurrentBookIndex] ?? currentProfile.books?.[0];

    if (shouldSendBooks) {
      for (let index = 0; index < currentProfileForm.books.length; index += 1) {
        const draft = currentProfileForm.books[index];
        const draftMode = progressModeForFormat(draft.format);
        const currentProgress = parseDraftProgress(draft.currentProgress, draftMode);
        const totalProgress = parseDraftProgress(draft.totalProgress, draftMode);

        if (currentProgress === null || totalProgress === null) {
          const slotLabel = BOOK_SLOT_OPTIONS.find((slot) => slot.index === index)?.label || `Book ${index + 1}`;
          setError(draftMode === 'audio'
            ? `${slotLabel} progress must be minutes or h/m format (e.g. 5h5m).`
            : `${slotLabel} progress must be a valid non-negative page count.`);
          return null;
        }

        normalizedBooks.push({
          title: draft.title,
          author: draft.author,
          imageData: draft.imageData,
          feeling: draft.feeling.replace(/[\r\n]+/g, ' ').slice(0, 160),
          currentRating: normalizeRating(draft.currentRating ?? 0),
          likeCount: normalizeLikeCount(currentProfile.books?.[index]?.likeCount ?? 0),
          format: draft.format,
          progressMode: draftMode,
          currentProgress,
          totalProgress,
        });
      }

      safeCurrentBookIndex = clampBookIndex(currentProfileForm.editingBookIndex);
      selectedBook = safeCurrentBookIndex === BETWEEN_BOOKS_INDEX
        ? { ...createDefaultBook(0), title: BETWEEN_BOOKS_TITLE }
        : normalizedBooks[safeCurrentBookIndex] ?? normalizedBooks[0];
    }

    const favoriteAuthors = currentProfileForm.favoriteAuthors
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const nextStatus = statusTextRef.current.trim() || 'Reading';
    const latestAvatarImageData = avatarImageDataRef.current;
    const draftAvatarImageData = typeof latestAvatarImageData === 'string' ? latestAvatarImageData : currentProfile.avatarImageData || '';
    const nextAvatarIcon = overrides.avatarIcon ?? avatarIconDraftRef.current ?? currentProfile.avatarIcon ?? '📚';
    const nextAvatarImageData = draftAvatarImageData;
    const sceneWidth = sceneRef.current?.clientWidth ?? 640;
    const sceneHeight = sceneRef.current?.clientHeight ?? 520;
    const normalizedAvatarPosition = toStoredPosition(avatarPosition, sceneWidth, sceneHeight);
    const payload: Record<string, unknown> = {};

    if (shouldSendBooks) {
      payload.books = normalizedBooks;
      payload.currentBookIndex = safeCurrentBookIndex;
      payload.currentBook = selectedBook?.title ?? currentProfile.currentBook;
      payload.currentAuthor = selectedBook?.author ?? currentProfile.currentAuthor;
      payload.currentPage = selectedBook?.currentProgress ?? currentProfile.currentPage;
      payload.totalPageCount = selectedBook?.totalProgress ?? currentProfile.totalPageCount;
      payload.progressMode = selectedBook?.progressMode ?? currentProfile.progressMode;
      if (safeCurrentBookIndex === BETWEEN_BOOKS_INDEX) {
        payload.currentBook = BETWEEN_BOOKS_TITLE;
        payload.currentAuthor = '';
        payload.currentPage = 0;
        payload.totalPageCount = 0;
        payload.progressMode = 'pages';
      }
    }

    if (shouldSendStatus) {
      payload.status = nextStatus;
    }

    if (shouldSendFullProfile) {
      payload.favoriteAuthors = favoriteAuthors;
      payload.backgroundScene = currentProfileForm.backgroundScene || currentProfile.backgroundScene || 'ocean-beach';
      payload.avatarIcon = nextAvatarIcon;
      payload.avatarImageData = nextAvatarImageData;
      payload.positionX = overrides.positionX !== undefined ? overrides.positionX : normalizedAvatarPosition.x;
      payload.positionY = overrides.positionY !== undefined ? overrides.positionY : normalizedAvatarPosition.y;
    }

    if (shouldSendAboutMe) {
      payload.aboutMeBio = (overrides.aboutMeBio ?? currentProfileForm.aboutMeBio).trim().slice(0, 280);
      payload.aboutMeLink = (overrides.aboutMeLink ?? currentProfileForm.aboutMeLink).trim().slice(0, 500);
    }

    if (overrides.positionX !== undefined) {
      payload.positionX = overrides.positionX;
    }

    if (overrides.positionY !== undefined) {
      payload.positionY = overrides.positionY;
    }

    if (overrides.isActive !== undefined) {
      payload.isActive = overrides.isActive;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl(`/api/profile/${encodeURIComponent(currentProfile.username)}?ts=${Date.now()}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Unable to update profile.');
        if (overrides.isActive === true || currentProfile.isActive === false) {
          setProfile(null);
          setHoveredReaderUsername(null);
          setUsername('');
          localStorage.removeItem('vwr-username');
        }
        return null;
      }

      if (data?.isActive === false) {
        setProfile(null);
        setHoveredReaderUsername(null);
        setUsername('');
        localStorage.removeItem('vwr-username');
        localStorage.removeItem('vwr-login-mode');
        localStorage.removeItem('vwr-avatar-position');
        return null;
      }

      if (suppressProfileStateRef.current || sessionVersion !== sessionVersionRef.current) {
        suppressProfileStateRef.current = false;
        return data;
      }

      const savedScene = data?.backgroundScene || currentProfileForm.backgroundScene || currentProfile.backgroundScene || 'ocean-beach';
      const normalizedIncoming = normalizeIncomingBooks(data as Partial<Profile>);
      const savedBook = normalizedIncoming.books[normalizedIncoming.currentBookIndex] ?? normalizedIncoming.books[0];
      const persistedAvatarImageData = typeof data?.avatarImageData === 'string'
        ? data.avatarImageData
        : (draftAvatarImageData ?? currentProfile.avatarImageData ?? '');
      setProfile((current) => {
        const merged = {
          ...(current ?? {}),
          ...data,
          books: normalizedIncoming.books,
          currentBookIndex: normalizedIncoming.currentBookIndex,
          currentBook: savedBook?.title ?? data?.currentBook,
          currentAuthor: savedBook?.author ?? data?.currentAuthor,
          currentPage: savedBook?.currentProgress ?? data?.currentPage,
          totalPageCount: savedBook?.totalProgress ?? data?.totalPageCount,
          progressMode: savedBook?.progressMode ?? data?.progressMode,
          backgroundScene: savedScene,
          avatarImageData: persistedAvatarImageData,
        };
        return {
          ...merged,
          avatarIcon: data.avatarIcon || nextAvatarIcon || current?.avatarIcon || merged.avatarIcon,
        } as Profile;
      });
      if (shouldSendFullProfile) {
        setAvatarIconDraft(data?.avatarIcon || nextAvatarIcon || currentProfile.avatarIcon || '📚');
        setAvatarImageData(persistedAvatarImageData);
        setProfileForm((current) => ({
          ...current,
          books: profileToBookDrafts(normalizedIncoming.books),
          editingBookIndex: normalizedIncoming.currentBookIndex,
          backgroundScene: savedScene,
          aboutMeBio: data?.aboutMeBio || '',
          aboutMeLink: data?.aboutMeLink || '',
        }));
        setScenePreview(savedScene);
      } else if (shouldSendAboutMe) {
        setProfileForm((current) => ({
          ...current,
          aboutMeBio: data?.aboutMeBio || '',
          aboutMeLink: data?.aboutMeLink || '',
        }));
      } else if (shouldSendBooks) {
        setProfileForm((current) => ({
          ...current,
          books: profileToBookDrafts(normalizedIncoming.books),
          editingBookIndex: normalizedIncoming.currentBookIndex,
        }));
      }
      loadOtherReaders();
      return data;
    } catch {
      setError('Unable to reach backend.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    await persistProfile();
  };

  const saveStatusAndMood = async () => {
    if (!profile || profile.isObserver) {
      return;
    }
    await persistProfile({}, 'status');
  };

  const saveAboutMe = async () => {
    if (!profile || profile.isObserver) {
      return;
    }
    if (profileForm.aboutMeLink.trim() && !safeExternalUrl(profileForm.aboutMeLink)) {
      setError('Link must be a valid http or https URL.');
      return;
    }
    await persistProfile({
      aboutMeBio: profileForm.aboutMeBio,
      aboutMeLink: profileForm.aboutMeLink,
    }, 'aboutMe');
  };

  const saveBookInformation = async () => {
    if (!profile || profile.isObserver) {
      return;
    }
    await persistProfile({}, 'books');
  };

  const handleLeave = async () => {
    if (!profile) return;

    const leavingProfile = profile;
    if (leavingProfile.isObserver) {
      sessionVersionRef.current += 1;
      pollVersionRef.current += 1;
      suppressProfileStateRef.current = true;
      profileRef.current = null;
      setOtherReaders((current) => current.filter((reader) => reader.username !== leavingProfile.username));
      setProfile(null);
      setHoveredReaderUsername(null);
      setUsername('');
      setError('');
      localStorage.removeItem('vwr-username');
      localStorage.removeItem('vwr-login-mode');
      localStorage.removeItem('vwr-avatar-position');
      void unregisterObserver(leavingProfile.username);
      return;
    }
    const normalizedBooks: ProfileBook[] = profileForm.books.map((draft, index) => {
      const mode = progressModeForFormat(draft.format);
      return {
        title: draft.title,
        author: draft.author,
        imageData: draft.imageData,
        feeling: draft.feeling.replace(/[\r\n]+/g, ' ').slice(0, 160),
        currentRating: normalizeRating(draft.currentRating ?? 0),
        likeCount: normalizeLikeCount(profile.books?.[index]?.likeCount ?? 0),
        format: draft.format,
        progressMode: mode,
        currentProgress: parseDraftProgress(draft.currentProgress, mode) ?? 0,
        totalProgress: parseDraftProgress(draft.totalProgress, mode) ?? 0,
      };
    });
    const safeCurrentBookIndex = safeEditingBookIndex;
    const selectedBook = safeCurrentBookIndex === BETWEEN_BOOKS_INDEX
      ? { ...createDefaultBook(0), title: BETWEEN_BOOKS_TITLE }
      : normalizedBooks[safeCurrentBookIndex] ?? normalizedBooks[0];
    const favoriteAuthors = profileForm.favoriteAuthors
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const nextStatus = statusText.trim() || 'Reading';

    sessionVersionRef.current += 1;
    pollVersionRef.current += 1;
    suppressProfileStateRef.current = true;
    profileRef.current = null;
    setOtherReaders((current) => current.filter((reader) => reader.username !== leavingProfile.username));
    setProfile(null);
    setHoveredReaderUsername(null);
    setUsername('');
    setError('');
    localStorage.removeItem('vwr-username');
    localStorage.removeItem('vwr-login-mode');
    localStorage.removeItem('vwr-avatar-position');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`vwr-removed:${leavingProfile.username}`, '1');
    }

    void fetch(apiUrl(`/api/profile/${encodeURIComponent(leavingProfile.username)}?ts=${Date.now()}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        books: normalizedBooks,
        currentBookIndex: safeCurrentBookIndex,
        currentBook: safeCurrentBookIndex === BETWEEN_BOOKS_INDEX ? BETWEEN_BOOKS_TITLE : selectedBook?.title ?? leavingProfile.currentBook,
        currentAuthor: safeCurrentBookIndex === BETWEEN_BOOKS_INDEX ? '' : selectedBook?.author ?? leavingProfile.currentAuthor,
        currentPage: safeCurrentBookIndex === BETWEEN_BOOKS_INDEX ? 0 : selectedBook?.currentProgress ?? leavingProfile.currentPage,
        totalPageCount: safeCurrentBookIndex === BETWEEN_BOOKS_INDEX ? 0 : selectedBook?.totalProgress ?? leavingProfile.totalPageCount,
        progressMode: safeCurrentBookIndex === BETWEEN_BOOKS_INDEX ? 'pages' : selectedBook?.progressMode ?? leavingProfile.progressMode,
        favoriteAuthors,
        status: nextStatus,
        aboutMeBio: profileForm.aboutMeBio.trim().slice(0, 280),
        aboutMeLink: profileForm.aboutMeLink.trim().slice(0, 500),
        backgroundScene: profileForm.backgroundScene || leavingProfile.backgroundScene || 'ocean-beach',
        avatarIcon: leavingProfile.avatarIcon,
      }),
    })
      .then(() => fetch(apiUrl(`/api/profile/${encodeURIComponent(leavingProfile.username)}/deactivate?ts=${Date.now()}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{}',
      }))
      .catch(() => undefined);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Please enter a reader display name.');
      return;
    }

    setLoading(true);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(`vwr-removed:${trimmed}`);
    }
    localStorage.setItem('vwr-username', trimmed);
    localStorage.setItem('vwr-login-mode', 'reader');
    setError('');

    try {
      const loginResult = await loadProfile(trimmed);
      if (loginResult.joined) {
        void registerDailyVisit(trimmed);
      }
      if (!loginResult.joined && loginResult.reason === 'active-limit') {
        const observerProfile = createObserverProfile(trimmed);
        setProfile(observerProfile);
        const { books, currentBookIndex } = normalizeIncomingBooks(observerProfile);
        setProfileForm({
          books: profileToBookDrafts(books),
          editingBookIndex: currentBookIndex,
          favoriteAuthors: observerProfile.favoriteAuthors.join(', '),
          backgroundScene: observerProfile.backgroundScene || 'ocean-beach',
          aboutMeBio: '',
          aboutMeLink: '',
        });
        setStatusText(observerProfile.status || 'Reading');
        setAvatarPosition(toRenderedPosition(observerProfile.positionX, observerProfile.positionY, sceneRef.current?.clientWidth ?? 640, sceneRef.current?.clientHeight ?? 520));
        localStorage.setItem('vwr-login-mode', 'observer');
        setError('The active reader limit has been reached. You are joining as an observer.');
        void registerObserver(trimmed);
        void registerDailyVisit(trimmed);
        refreshSceneData(trimmed);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarMouseEnter = (username: string) => {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      if (pinnedReaderUsername && pinnedReaderUsername !== username) {
        return;
      }
      setHoveredReaderUsername(username);
    }
  };

  const handleAvatarMouseLeave = (username: string) => {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      if (pinnedReaderUsername === username) {
        return;
      }
      setHoveredReaderUsername((current) => (current === username ? null : current));
    }
  };

  const handleAvatarClick = (event: React.MouseEvent<HTMLDivElement>, username: string) => {
    event.preventDefault();
    event.stopPropagation();
    setPinnedReaderUsername((currentPinned) => {
      const nextPinned = currentPinned === username ? null : username;
      setHoveredReaderUsername(nextPinned);
      return nextPinned;
    });
  };

  const activeTooltipUsername = pinnedReaderUsername ?? hoveredReaderUsername;
  useEffect(() => {
    setTooltipBookSelection(null);
  }, [activeTooltipUsername]);
  const isSceneExpanded = isSceneImmersive || isSceneNativeFullscreen;

  const safeEditingBookIndex = clampBookIndex(profileForm.editingBookIndex);
  const activeReaderCount = profile?.isObserver ? otherReaders.length : otherReaders.length + 1;

  // Recipients for the chat dropdown: people who wrote to you, readers here now, then anyone else in today's chat.
  const chatMe = profile?.username ?? '';
  const chatAuthorAvatars = new Map<string, { avatarIcon: string; avatarImageData: string }>();
  const chatWroteToMe = new Set<string>();
  for (const entry of chatMessages) {
    if (entry.author === chatMe) {
      continue;
    }
    chatAuthorAvatars.set(entry.author, { avatarIcon: entry.avatarIcon, avatarImageData: entry.avatarImageData });
    if (entry.toUsername === chatMe) {
      chatWroteToMe.add(entry.author);
    }
  }
  const chatPresentNames = new Set(otherReaders.filter((reader) => reader.username !== chatMe && !reader.isGhost).map((reader) => reader.username));
  const chatGhostNames = new Set(otherReaders.filter((reader) => reader.username !== chatMe && reader.isGhost).map((reader) => reader.username));
  const chatRecipientGroups = (() => {
    const taken = new Set<string>();
    const take = (names: string[]) => names
      .sort((a, b) => a.localeCompare(b))
      .filter((name) => {
        if (!name || name === chatMe || taken.has(name)) {
          return false;
        }
        taken.add(name);
        return true;
      });
    const wroteToYou = take(Array.from(chatWroteToMe));
    const active = take(Array.from(chatPresentNames));
    const ghosts = take(Array.from(chatGhostNames));
    const visitedToday = take(todayChatReaders.map((reader) => reader.username));
    const others = take([...Array.from(chatAuthorAvatars.keys()), ...(chatTarget ? [chatTarget.username] : [])]);
    return { wroteToYou, active, ghosts, visitedToday, others };
  })();
  const handleChatRecipientChange = (username: string) => {
    if (!username) {
      setChatTarget(null);
      return;
    }
    const present = otherReaders.find((reader) => reader.username === username);
    const visited = todayChatReaders.find((reader) => reader.username === username);
    const author = chatAuthorAvatars.get(username);
    const avatarIcon = present?.avatarIcon || visited?.avatarIcon || author?.avatarIcon || '📚';
    const avatarImageData = present?.avatarImageData || visited?.avatarImageData || author?.avatarImageData || '';
    setChatTarget((current) => ({
      username,
      avatarIcon,
      avatarImageData,
      bookTitle: current?.username === username ? current.bookTitle : '',
    }));
  };
  const isEditingBetweenBooks = safeEditingBookIndex === BETWEEN_BOOKS_INDEX;
  const editingBook = profileForm.books[safeEditingBookIndex] ?? profileForm.books[0] ?? {
    title: '',
    author: '',
    imageData: '',
    format: 'physical' as BookFormat,
    currentRating: 0,
    currentProgress: '0',
    totalProgress: '0',
  };
  const editingBookMode = progressModeForFormat(editingBook?.format ?? 'physical');
  const editingProgressPercent = formatProgressPercent(
    parseDraftProgress(editingBook.currentProgress, editingBookMode),
    parseDraftProgress(editingBook.totalProgress, editingBookMode),
  );
  const currentBookSlotLabels = BOOK_SLOT_OPTIONS.map((slot) => {
    if (slot.index === BETWEEN_BOOKS_INDEX) {
      return BETWEEN_BOOKS_TITLE;
    }
    const book = profileForm.books[slot.index];
    const label = book?.title?.trim() || slot.label;
    return `${slot.label}: ${label}`;
  });

  const selectedScene = profileForm.backgroundScene || scenePreview;
  const selectedSceneOption = SCENE_OPTIONS.find((option) => option.value === selectedScene) ?? SCENE_OPTIONS[0];
  const isForestScene = selectedSceneOption.value === 'lush-forest';
  const isRainScene = selectedSceneOption.value === 'rain';
  const announcementVariant = announcementVariantForScene(selectedSceneOption.value);
  const announcementDateLabel = formatLocalAnnouncementDate();
  const scenePanelBackgroundImage = `${import.meta.env.BASE_URL}${selectedSceneOption.imagePath}`;
  const scenePanelOverlay = selectedSceneOption.overlay;
  const sceneWidth = sceneRef.current?.clientWidth ?? 640;
  const currentTooltipClassName = tooltipPlacementClass(getTooltipPlacement(avatarPosition, sceneWidth));
  const currentRatingValue = normalizeRating(editingBook.currentRating ?? 0);
  const ratingSliderStyle = {
    ['--rating-fill' as string]: `${(currentRatingValue / 5) * 100}%`,
  } as React.CSSProperties;

  const renderAvatarContent = (reader: { avatarIcon?: string; avatarImageData?: string; isObserver?: boolean }, fallbackIcon: string = '📚') => {
    const hasCustomImage = typeof reader.avatarImageData === 'string' && reader.avatarImageData.trim().length > 0;
    if (hasCustomImage) {
      return <img className="avatar-image" src={reader.avatarImageData} alt="" />;
    }
    return <span role="img" aria-label="reader">{reader.avatarIcon || fallbackIcon}</span>;
  };

  const renderStatusLike = (reader: SceneReader, isSelf: boolean) => {
    const count = isSelf ? myStatusLikeCount : normalizeLikeCount(reader.statusLikeCount);
    const sessionKey = `${reader.username}::${reader.status}`;
    const liked = likedStatusSessionKeys.has(sessionKey);
    const disabled = !profile || profile.isObserver || pendingStatusLikeKey === sessionKey;

    return (
      <span className="status-like">
        <button
          type="button"
          className={`status-like-button ${liked ? 'status-like-button-done' : ''}`}
          onClick={(event) => toggleStatusLike(event, reader)}
          disabled={disabled}
          aria-label={liked ? 'Unlike this status' : 'Like this status'}
          title={liked ? 'Unlike this status' : 'Like this status'}
        >
          {liked ? '♥' : '♡'}
        </button>
        {count > 0 && <span className="status-like-count" aria-live="polite">{count}</span>}
      </span>
    );
  };

  const renderReadingTimeBadge = (reader: { username: string; loginTimeUtc?: number; isObserver?: boolean }) => {
    if (reader.isObserver || !reader.loginTimeUtc || reader.loginTimeUtc <= 0) {
      return null;
    }
    return <span className="reader-time-badge">{formatReadingDuration(reader.loginTimeUtc, browserNow)}</span>;
  };

  const mergeIncomingReaderProfile = (currentReader: SceneReader, incoming: Partial<Profile>): SceneReader => {
    const normalizedIncoming = normalizeIncomingBooks(incoming);
    const safeBookIndex = clampBookIndex(normalizedIncoming.currentBookIndex);
    const selectedBook = normalizedIncoming.books[safeBookIndex] ?? normalizedIncoming.books[0];
    return {
      ...currentReader,
      ...incoming,
      books: normalizedIncoming.books,
      currentBookIndex: safeBookIndex,
      currentBook: selectedBook?.title ?? currentReader.currentBook,
      currentAuthor: selectedBook?.author ?? currentReader.currentAuthor,
      currentPage: selectedBook?.currentProgress ?? currentReader.currentPage,
      totalPageCount: selectedBook?.totalProgress ?? currentReader.totalPageCount,
      progressMode: selectedBook?.progressMode ?? currentReader.progressMode,
      positionX: incoming.positionX !== undefined ? normalizeIncomingPosition(incoming.positionX) : currentReader.positionX,
      positionY: incoming.positionY !== undefined ? normalizeIncomingPosition(incoming.positionY) : currentReader.positionY,
    };
  };

  const toggleBulletinPostLike = async (event: React.MouseEvent<HTMLButtonElement>, post: BulletinPost) => {
    event.preventDefault();
    event.stopPropagation();

    const sessionKey = `${post.dayKey}:${post.postId}`;
    const alreadyLiked = likedBulletinSessionKeys.has(sessionKey);
    if (pendingBulletinLikeKey === sessionKey) {
      return;
    }

    setPendingBulletinLikeKey(sessionKey);
    try {
      const response = await fetch(apiUrl(`/api/bulletin/posts/${post.postId}/like?ts=${Date.now()}`), {
        method: alreadyLiked ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Unable to update bulletin like right now.');
        return;
      }

      const normalized = normalizeBulletinPost(data);
      if (!normalized) {
        return;
      }

      setBulletinPosts((current) => current.map((entry) => (
        entry.dayKey === normalized.dayKey && entry.postId === normalized.postId ? normalized : entry
      )));

      setLikedBulletinSessionKeys((current) => {
        const next = new Set(current);
        if (alreadyLiked) {
          next.delete(sessionKey);
        } else {
          next.add(sessionKey);
        }
        return next;
      });
    } catch {
      setError('Unable to reach backend.');
    } finally {
      setPendingBulletinLikeKey((current) => (current === sessionKey ? null : current));
    }
  };

  const submitBulletinPost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) {
      return;
    }

    const text = bulletinDraft.trim();
    if (!text && !bulletinImageDraft) {
      return;
    }

    setIsPostingBulletin(true);
    try {
      const response = await fetch(apiUrl(`/api/bulletin/posts?ts=${Date.now()}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          author: profile.username,
          avatarIcon: profile.avatarIcon,
          avatarImageData: profile.avatarImageData || '',
          text,
          imageData: bulletinImageDraft,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Unable to post bulletin entry.');
        return;
      }

      const normalized = normalizeBulletinPost(data);
      if (!normalized) {
        setError('Unable to post bulletin entry.');
        return;
      }

      setBulletinDraft('');
      setBulletinImageDraft('');
      setBulletinPosts((current) => [normalized, ...current.filter((entry) => !(entry.dayKey === normalized.dayKey && entry.postId === normalized.postId))]);
    } catch {
      setError('Unable to reach backend.');
    } finally {
      setIsPostingBulletin(false);
    }
  };

  const deleteOwnBulletinPost = async (event: React.MouseEvent<HTMLButtonElement>, post: BulletinPost) => {
    event.preventDefault();
    event.stopPropagation();

    if (!profile?.username) {
      return;
    }

    const sessionKey = `${post.dayKey}:${post.postId}`;
    if (pendingBulletinDeleteKey === sessionKey) {
      return;
    }

    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }

    setPendingBulletinDeleteKey(sessionKey);
    try {
      const response = await fetch(apiUrl(`/api/bulletin/posts/${post.postId}?ts=${Date.now()}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ author: profile.username }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Unable to delete this bulletin post right now.');
        return;
      }

      setBulletinPosts((current) => current.filter((entry) => !(entry.dayKey === post.dayKey && entry.postId === post.postId)));
      setLikedBulletinSessionKeys((current) => {
        const next = new Set(current);
        next.delete(sessionKey);
        return next;
      });
    } catch {
      setError('Unable to reach backend.');
    } finally {
      setPendingBulletinDeleteKey((current) => (current === sessionKey ? null : current));
    }
  };

  const handleBulletinImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await resizeImageDataUrl(file, {
        targetWidth: 960,
        targetHeight: 960,
        quality: 0.92,
        padToBounds: false,
      });
      setBulletinImageDraft(dataUrl);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to upload image.');
    } finally {
      event.target.value = '';
    }
  };

  const acknowledgeChatPings = () => {
    if (!profile || profile.isObserver || chatPings.length === 0) {
      return;
    }
    setChatPings([]);
    void fetch(apiUrl(`/api/chat/pings/${encodeURIComponent(profile.username)}?ts=${Date.now()}`), { method: 'DELETE' }).catch(() => undefined);
  };

  const focusChatComposer = () => {
    window.setTimeout(() => {
      chatBoardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const textarea = chatTextareaRef.current;
      if (textarea) {
        textarea.focus();
        const end = textarea.value.length;
        textarea.setSelectionRange(end, end);
      }
    }, 80);
  };

  const startChatAbout = (event: React.MouseEvent<HTMLButtonElement>, reader: SceneReader, bookTitle: string) => {
    event.preventDefault();
    event.stopPropagation();

    if (!profile || profile.isObserver || reader.username === profile.username) {
      return;
    }

    const title = bookTitle.trim();

    setIsChatCollapsed(false);
    setChatTarget({
      username: reader.username,
      avatarIcon: reader.avatarIcon || '📚',
      avatarImageData: reader.avatarImageData || '',
      bookTitle: title,
    });
    setPinnedReaderUsername(null);
    setHoveredReaderUsername(null);
    if (isSceneImmersive || isSceneNativeFullscreen) {
      void exitSceneFullscreen();
    }

    void fetch(apiUrl(`/api/chat/pings?ts=${Date.now()}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: profile.username, to: reader.username, bookTitle: title }),
    }).catch(() => undefined);

    focusChatComposer();
  };

  const submitChatMessage = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!profile || profile.isObserver || isPostingChat) {
      return;
    }

    const text = chatDraft.trim();
    if (!text && !chatImageDraft) {
      return;
    }

    setIsPostingChat(true);
    try {
      const response = await fetch(apiUrl(`/api/chat/messages?ts=${Date.now()}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: profile.username,
          avatarIcon: profile.avatarIcon,
          avatarImageData: profile.avatarImageData || '',
          text,
          imageData: chatImageDraft,
          ...(chatTarget ? {
            toUsername: chatTarget.username,
            toAvatarIcon: chatTarget.avatarIcon,
            toAvatarImageData: chatTarget.avatarImageData,
            bookTitle: chatTarget.bookTitle,
          } : {}),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Unable to send message.');
        return;
      }

      const normalized = normalizeChatMessage(data);
      if (!normalized) {
        setError('Unable to send message.');
        return;
      }

      setChatDraft('');
      // The recipient stays selected for back-and-forth chat; the book note applies to the first message only.
      setChatTarget((current) => (current ? { ...current, bookTitle: '' } : current));
      setChatImageDraft('');
      chatStickToBottomRef.current = true;
      // The poll cursor is left alone so messages from others with lower ids are not skipped.
      setChatMessages((current) => (
        current.some((entry) => entry.messageId === normalized.messageId && entry.dayKey === normalized.dayKey)
          ? current
          : [...current, normalized].sort((a, b) => a.messageId - b.messageId)
      ));
      acknowledgeChatPings();
      if (chatTarget) {
        void fetch(apiUrl(`/api/chat/pings?ts=${Date.now()}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: profile.username, to: chatTarget.username, bookTitle: chatTarget.bookTitle }),
        }).catch(() => undefined);
      }
    } catch {
      setError('Unable to reach backend.');
    } finally {
      setIsPostingChat(false);
    }
  };

  const toggleStatusLike = async (event: React.MouseEvent<HTMLButtonElement>, reader: SceneReader) => {
    event.preventDefault();
    event.stopPropagation();

    if (!profile || profile.isObserver) {
      return;
    }

    const statusAtClick = reader.status;
    const sessionKey = `${reader.username}::${statusAtClick}`;
    const alreadyLiked = likedStatusSessionKeys.has(sessionKey);
    if (pendingStatusLikeKey === sessionKey) {
      return;
    }

    setPendingStatusLikeKey(sessionKey);
    try {
      const response = await fetch(apiUrl(`/api/profile/${encodeURIComponent(reader.username)}/status-like?ts=${Date.now()}`), {
        method: alreadyLiked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusAtClick }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Unable to like this status right now.');
        return;
      }

      const nextCount = normalizeLikeCount(data?.statusLikeCount);
      if (reader.username === profile.username) {
        setMyStatusLikeCount(nextCount);
      } else {
        setOtherReaders((current) => current.map((entry) => (
          entry.username === reader.username ? { ...entry, statusLikeCount: nextCount } : entry
        )));
      }

      // A stale click (the reader changed status meanwhile) is not remembered as a like.
      if (data?.applied) {
        setLikedStatusSessionKeys((current) => {
          const next = new Set(current);
          if (alreadyLiked) {
            next.delete(sessionKey);
          } else {
            next.add(sessionKey);
          }
          return next;
        });
      }
    } catch {
      setError('Unable to reach backend.');
    } finally {
      setPendingStatusLikeKey((current) => (current === sessionKey ? null : current));
    }
  };

  const toggleChatMessageLike = async (event: React.MouseEvent<HTMLButtonElement>, message: ChatMessage) => {
    event.preventDefault();
    event.stopPropagation();

    const sessionKey = `${message.dayKey}:${message.messageId}`;
    const alreadyLiked = likedChatSessionKeys.has(sessionKey);
    if (pendingChatLikeId === message.messageId) {
      return;
    }

    setPendingChatLikeId(message.messageId);
    try {
      const response = await fetch(apiUrl(`/api/chat/messages/${message.messageId}/like?ts=${Date.now()}`), {
        method: alreadyLiked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Unable to update chat like right now.');
        return;
      }

      const normalized = normalizeChatMessage(data);
      if (!normalized) {
        return;
      }

      setChatMessages((current) => current.map((entry) => (
        entry.dayKey === normalized.dayKey && entry.messageId === normalized.messageId
          ? { ...entry, likeCount: normalized.likeCount }
          : entry
      )));
      setLikedChatSessionKeys((current) => {
        const next = new Set(current);
        if (alreadyLiked) {
          next.delete(sessionKey);
        } else {
          next.add(sessionKey);
        }
        return next;
      });
    } catch {
      setError('Unable to reach backend.');
    } finally {
      setPendingChatLikeId((current) => (current === message.messageId ? null : current));
    }
  };

  const deleteOwnChatMessage = async (event: React.MouseEvent<HTMLButtonElement>, message: ChatMessage) => {
    event.preventDefault();
    event.stopPropagation();

    if (!profile || profile.isObserver || pendingChatDeleteId === message.messageId) {
      return;
    }

    if (!window.confirm('Delete this message? This cannot be undone.')) {
      return;
    }

    setPendingChatDeleteId(message.messageId);
    try {
      const response = await fetch(apiUrl(`/api/chat/messages/${message.messageId}?ts=${Date.now()}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: profile.username }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Unable to delete this message right now.');
        return;
      }
      setChatMessages((current) => current.filter((entry) => entry.messageId !== message.messageId));
    } catch {
      setError('Unable to reach backend.');
    } finally {
      setPendingChatDeleteId((current) => (current === message.messageId ? null : current));
    }
  };

  const handleChatImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await resizeImageDataUrl(file, {
        targetWidth: 960,
        targetHeight: 960,
        quality: 0.92,
        padToBounds: false,
      });
      setChatImageDraft(dataUrl);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to upload image.');
    } finally {
      event.target.value = '';
    }
  };

  const toggleBookLikeFromTooltip = async (
    event: React.MouseEvent<HTMLButtonElement>,
    targetUsername: string,
    bookIndex: number,
    book: Partial<ProfileBook> | undefined,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!profile || profile.isObserver) {
      return;
    }

    const sessionKey = buildBookLikeSessionKey(targetUsername, bookIndex, book);
    const isAlreadyLiked = likedBookSessionKeys.has(sessionKey);
    if (pendingLikeKey === sessionKey) {
      return;
    }

    setPendingLikeKey(sessionKey);
    try {
      const response = await fetch(apiUrl(`/api/profile/${encodeURIComponent(targetUsername)}/books/${bookIndex}/like?ts=${Date.now()}`), {
        method: isAlreadyLiked ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Unable to like this book right now.');
        return;
      }

      setLikedBookSessionKeys((current) => {
        const next = new Set(current);
        if (isAlreadyLiked) {
          next.delete(sessionKey);
        } else {
          next.add(sessionKey);
        }
        return next;
      });

      const incomingProfile = data?.profile as Partial<Profile> | undefined;
      if (!incomingProfile) {
        return;
      }

      if (targetUsername === profile.username) {
        setMySceneBooks({ username: targetUsername, books: normalizeIncomingBooks(incomingProfile).books });
        setProfile((current) => {
          if (!current) {
            return current;
          }
          return mergeIncomingReaderProfile(current, incomingProfile);
        });
      } else {
        setOtherReaders((current) => current.map((reader) => (
          reader.username === targetUsername ? mergeIncomingReaderProfile(reader, incomingProfile) : reader
        )));
      }
    } catch {
      setError('Unable to reach backend.');
    } finally {
      setPendingLikeKey((current) => (current === sessionKey ? null : current));
    }
  };

  const toggleFeelingLike = async (event: React.MouseEvent<HTMLButtonElement>, reader: SceneReader, bookIndex: number, book: ProfileBook) => {
    event.preventDefault();
    event.stopPropagation();
    if (!profile || profile.isObserver || !book.feeling?.trim()) return;

    const sessionKey = buildFeelingLikeSessionKey(reader.username, bookIndex, book);
    if (pendingFeelingLikeKey) return;
    const alreadyLiked = likedFeelingSessionKeys.has(sessionKey);
    setPendingFeelingLikeKey(sessionKey);
    try {
      const response = await fetch(apiUrl(`/api/profile/${encodeURIComponent(reader.username)}/books/${bookIndex}/feeling-like?ts=${Date.now()}`), {
        method: alreadyLiked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: book.title, feeling: book.feeling }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Unable to like this feeling right now.');
        return;
      }
      setLikedFeelingSessionKeys((current) => {
        const next = new Set(current);
        if (alreadyLiked) next.delete(sessionKey);
        else next.add(sessionKey);
        return next;
      });
      const incomingProfile = data?.profile as Partial<Profile> | undefined;
      if (incomingProfile) {
        if (reader.username === profile.username) {
          setMySceneBooks({ username: reader.username, books: normalizeIncomingBooks(incomingProfile).books });
          setProfile((current) => current ? mergeIncomingReaderProfile(current, incomingProfile) : current);
        } else {
          setOtherReaders((current) => current.map((entry) => entry.username === reader.username ? mergeIncomingReaderProfile(entry, incomingProfile) : entry));
        }
      }
    } catch {
      setError('Unable to reach backend.');
    } finally {
      setPendingFeelingLikeKey(null);
    }
  };

  const renderReaderTooltip = (reader: SceneReader, tooltipClassName: string) => {
    const currentBookIndex = clampBookIndex(reader.currentBookIndex);
    const availableBookIndices = (reader.books || [])
      .slice(0, BOOK_SLOT_COUNT)
      .map((book, index) => book?.title?.trim() ? index : -1)
      .filter((index) => index >= 0);
    const selectedBookIndex = tooltipBookSelection?.username === reader.username
      && tooltipBookSelection.currentBookIndex === currentBookIndex
      && availableBookIndices.includes(tooltipBookSelection.bookIndex)
      ? tooltipBookSelection.bookIndex
      : availableBookIndices.includes(currentBookIndex) ? currentBookIndex : availableBookIndices[0];
    const safeBookIndex = selectedBookIndex ?? currentBookIndex;
    const currentBookDetails = reader.books?.[safeBookIndex];
    const hasDisplayedBook = selectedBookIndex !== undefined;
    const changeBook = (direction: number) => {
      const position = availableBookIndices.indexOf(safeBookIndex);
      const nextPosition = (position + direction + availableBookIndices.length) % availableBookIndices.length;
      setTooltipBookSelection({ username: reader.username, bookIndex: availableBookIndices[nextPosition], currentBookIndex });
    };
    const polledBook = reader.username === profile?.username && mySceneBooks?.username === reader.username
      ? mySceneBooks.books[safeBookIndex]
      : undefined;
    const matchingPolledBook = polledBook?.title.trim() === currentBookDetails?.title.trim() ? polledBook : undefined;
    const feelingLikeKey = buildFeelingLikeSessionKey(reader.username, safeBookIndex, currentBookDetails);
    const feelingAlreadyLiked = likedFeelingSessionKeys.has(feelingLikeKey);
    const aboutMeLink = safeExternalUrl(reader.aboutMeLink);
    const hasAboutMe = Boolean(reader.aboutMeBio?.trim() || aboutMeLink);
    const betweenBooksActive = !hasDisplayedBook || safeBookIndex === BETWEEN_BOOKS_INDEX
      || (typeof currentBookDetails?.title === 'string' && currentBookDetails.title.trim().toLowerCase() === BETWEEN_BOOKS_TITLE.toLowerCase());
    const likeCount = normalizeLikeCount(matchingPolledBook?.likeCount ?? currentBookDetails?.likeCount ?? 0);
    const likeSessionKey = buildBookLikeSessionKey(reader.username, safeBookIndex, currentBookDetails);
    const alreadyLiked = likedBookSessionKeys.has(likeSessionKey);
    const isPending = pendingLikeKey === likeSessionKey;
    const likeDisabled = !profile || profile.isObserver || isPending || betweenBooksActive;

    return (
      <div
        className={`avatar-tooltip ${tooltipClassName}`}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {!betweenBooksActive && (
          <div className="tooltip-like-inline-row">
            {availableBookIndices.length > 1 && (
              <div className="tooltip-book-navigation" aria-label="Book navigation">
                <button type="button" className="tooltip-book-nav-button" aria-label="Previous book" title="Previous book" onClick={() => changeBook(-1)}>‹</button>
                <span aria-live="polite">{availableBookIndices.indexOf(safeBookIndex) + 1} / {availableBookIndices.length}</span>
                <button type="button" className="tooltip-book-nav-button" aria-label="Next book" title="Next book" onClick={() => changeBook(1)}>›</button>
              </div>
            )}
            <button
              type="button"
              className={`tooltip-like-button ${alreadyLiked ? 'tooltip-like-button-done' : ''}`}
              onClick={(event) => toggleBookLikeFromTooltip(event, reader.username, safeBookIndex, currentBookDetails)}
              disabled={likeDisabled}
              aria-label={alreadyLiked ? 'Unlike this book' : 'Like this book'}
            >
              {alreadyLiked ? '♥' : '♡'}
            </button>
            <span className="tooltip-like-count" aria-live="polite">{likeCount}</span>
          </div>
        )}
        {currentBookDetails?.imageData && !betweenBooksActive ? (
          <div className="tooltip-book-content">
            <img className="tooltip-book-cover" src={currentBookDetails.imageData} alt={`Cover of ${currentBookDetails.title}`} />
            <div className="tooltip-book-details">
              <div className="tooltip-book-title">{currentBookDetails.title}</div>
              <div className="tooltip-book-author">{currentBookDetails.author}</div>
            </div>
          </div>
        ) : betweenBooksActive ? null : (
          <>
            <div className="tooltip-row">
              <span className="tooltip-label">Title</span>
              <span>{currentBookDetails?.title}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Author</span>
              <span>{currentBookDetails?.author}</span>
            </div>
          </>
        )}
        {!betweenBooksActive && (
          <div className="tooltip-row">
            <span className="tooltip-label">{progressLabel(currentBookDetails?.progressMode ?? 'pages')}</span>
            <span>
              {formatProgressDisplay(currentBookDetails?.currentProgress ?? 0, currentBookDetails?.totalProgress ?? 0, currentBookDetails?.progressMode ?? 'pages')}
              {formatProgressPercent(currentBookDetails?.currentProgress ?? 0, currentBookDetails?.totalProgress ?? 0) && (
                <span className="progress-percent">{formatProgressPercent(currentBookDetails?.currentProgress ?? 0, currentBookDetails?.totalProgress ?? 0)}</span>
              )}
            </span>
          </div>
        )}
        {!betweenBooksActive && currentBookDetails?.feeling?.trim() && (
          <div className="tooltip-book-feeling">
            <span className="tooltip-book-feeling-text">{currentBookDetails.feeling}</span>
            <span className="tooltip-feeling-like">
              <button
                type="button"
                className={`tooltip-like-button ${feelingAlreadyLiked ? 'tooltip-like-button-done' : ''}`}
                onClick={(event) => toggleFeelingLike(event, reader, safeBookIndex, currentBookDetails)}
                disabled={!profile || profile.isObserver || pendingFeelingLikeKey !== null}
                aria-label={feelingAlreadyLiked ? 'Unlike this feeling' : 'Like this feeling'}
                aria-pressed={feelingAlreadyLiked}
                title={feelingAlreadyLiked ? 'Unlike this feeling' : 'Like this feeling'}
              >
                {feelingAlreadyLiked ? '♥' : '♡'}
              </button>
              <span className="tooltip-like-count" aria-live="polite">{normalizeLikeCount(matchingPolledBook?.feeling === currentBookDetails.feeling ? matchingPolledBook.feelingLikeCount : currentBookDetails.feelingLikeCount)}</span>
            </span>
          </div>
        )}
        {!betweenBooksActive && reader.books?.[safeBookIndex]?.currentRating !== undefined && (
          <div className="tooltip-rating-only">
            {renderRatingStars(reader.books[safeBookIndex].currentRating ?? 0)}
          </div>
        )}
        {profile && (hasAboutMe || (reader.username !== profile.username && !profile.isObserver)) && (
          <div className="tooltip-actions">
            <div className="tooltip-chat-row">
              {hasAboutMe && (
                <button
                  type="button"
                  className="tooltip-chat-button"
                  aria-expanded={aboutMePopupUsername === reader.username}
                  onClick={() => setAboutMePopupUsername((current) => current === reader.username ? null : reader.username)}
                >
                  About me
                </button>
              )}
              {!profile.isObserver && reader.username !== profile.username && (
                <button
                  type="button"
                  className="tooltip-chat-button"
                  onClick={(event) => startChatAbout(event, reader, betweenBooksActive ? '' : currentBookDetails?.title ?? '')}
                >
                  💬 Chat
                </button>
              )}
            </div>
            {hasAboutMe && aboutMePopupUsername === reader.username && (
              <div className="about-me-popup" role="dialog" aria-label={`${reader.username}'s About me`}>
                <div className="about-me-popup-header">
                  <strong>About {reader.username}</strong>
                  <button
                    type="button"
                    className="about-me-popup-close"
                    aria-label="Close About me"
                    onClick={() => setAboutMePopupUsername(null)}
                  >
                    ×
                  </button>
                </div>
                {reader.aboutMeBio?.trim() ? <p>{reader.aboutMeBio}</p> : <p className="about-me-empty">No bio added.</p>}
                {aboutMeLink && <a href={aboutMeLink} target="_blank" rel="noopener noreferrer">{aboutMeLink}</a>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await resizeImageDataUrl(file);
      setAvatarImageData(dataUrl);
      setAvatarIconDraft('📚');
      setAvatarMenuOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to upload image.');
    } finally {
      event.target.value = '';
    }
  };

  const handleBookCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>, bookIndex: number) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for the book cover.');
      return;
    }

    const sessionVersion = sessionVersionRef.current;
    try {
      const imageData = await resizeImageDataUrl(file, {
        targetWidth: 360,
        targetHeight: 480,
        outputType: 'image/jpeg',
        quality: 0.85,
        padToBounds: false,
      });
      if (sessionVersion !== sessionVersionRef.current) return;
      setProfileForm((current) => ({
        ...current,
        books: current.books.map((book, index) => index === bookIndex ? { ...book, imageData } : book),
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to upload book cover.');
    }
  };

  const avatarPreviewValue = avatarImageData ? (
    <img className="avatar-menu-preview-image" src={avatarImageData} alt="Selected avatar" />
  ) : (
    <span className="avatar-menu-preview-emoji" role="img" aria-label="selected avatar emoji">{avatarIconDraft || '📚'}</span>
  );

  const handleSceneClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    const scene = sceneRef.current;
    if (!scene || !profile || profile.isObserver) return;

    const clickedAvatar = (event.target as HTMLElement | null)?.closest('.avatar-wrapper');
    if (clickedAvatar) {
      return;
    }

    if (activeTooltipUsername) {
      setPinnedReaderUsername(null);
      setHoveredReaderUsername(null);
      return;
    }

    const rect = scene.getBoundingClientRect();
    const x = event.clientX - rect.left - AVATAR_SIZE / 2;
    const y = event.clientY - rect.top - AVATAR_SIZE / 2;
    const nextPosition = clampScenePosition({ x, y }, rect.width, rect.height);
    setAvatarPosition(nextPosition);
    void persistAvatarPosition(nextPosition);
  };

  const exitSceneFullscreen = async () => {
    setIsSceneImmersive(false);
    const fullscreenDocument = document as FullscreenDocument;

    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
        return;
      }
      if (fullscreenDocument.webkitFullscreenElement && fullscreenDocument.webkitExitFullscreen) {
        await fullscreenDocument.webkitExitFullscreen();
      }
    } catch {
      // Keep the fallback immersive mode reversible even if the browser fullscreen API fails.
    }
  };

  const toggleSceneFullscreen = async () => {
    const sceneElement = sceneRef.current as FullscreenSceneElement | null;
    if (!sceneElement) {
      return;
    }

    if (isSceneExpanded) {
      await exitSceneFullscreen();
      return;
    }

    setIsSceneImmersive(true);

    try {
      if (sceneElement.requestFullscreen) {
        await sceneElement.requestFullscreen();
        return;
      }
      if (sceneElement.webkitRequestFullscreen) {
        await sceneElement.webkitRequestFullscreen();
      }
    } catch {
      // The fixed-position immersive fallback still works when the Fullscreen API is unavailable.
    }
  };

  const loadForestBuffer = async (context: AudioContext): Promise<AudioBuffer> => {
    if (forestAudioBufferRef.current) {
      return forestAudioBufferRef.current;
    }

    const response = await fetch(`${import.meta.env.BASE_URL}bird.wav`);
    if (!response.ok) {
      throw new Error('Unable to load forest sound.');
    }

    const arrayBuffer = await response.arrayBuffer();
    const decodedBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    const trimmedBuffer = trimAudioBufferEdges(decodedBuffer);
    forestAudioBufferRef.current = trimmedBuffer;
    return trimmedBuffer;
  };

  const stopForestSound = () => {
    const source = forestAudioSourceRef.current;
    const context = forestAudioContextRef.current;

    forestAudioSourceRef.current = null;
    forestAudioContextRef.current = null;

    if (source) {
      try {
        source.stop();
      } catch {
        // ignore already-ended sources
      }
      source.disconnect();
    }

    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined);
    }
  };

  const toggleForestSound = async () => {
    if (!isForestScene) {
      return;
    }

    if (isForestSoundEnabled) {
      stopForestSound();
      setIsForestSoundEnabled(false);
      return;
    }

    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        setError('Your browser does not support the forest sound effect.');
        return;
      }

      const context = new AudioContextCtor();
      if (context.state === 'suspended') {
        await context.resume();
      }

      const buffer = await loadForestBuffer(context);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = buffer.duration;

      const gain = context.createGain();
      gain.gain.value = 0.45;

      source.connect(gain);
      gain.connect(context.destination);
      source.start();

      forestAudioContextRef.current = context;
      forestAudioSourceRef.current = source;
      setIsForestSoundEnabled(true);
    } catch {
      stopForestSound();
      setError('Unable to start forest sound right now.');
    }
  };

  const loadRainBuffer = async (context: AudioContext): Promise<AudioBuffer> => {
    if (rainAudioBufferRef.current) {
      return rainAudioBufferRef.current;
    }

    const response = await fetch(`${import.meta.env.BASE_URL}rain.wav`);
    if (!response.ok) {
      throw new Error('Unable to load rain sound.');
    }

    const arrayBuffer = await response.arrayBuffer();
    const decodedBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    const trimmedBuffer = trimAudioBufferEdges(decodedBuffer);
    rainAudioBufferRef.current = trimmedBuffer;
    return trimmedBuffer;
  };

  const stopRainSound = () => {
    const source = rainAudioSourceRef.current;
    const context = rainAudioContextRef.current;

    rainAudioSourceRef.current = null;
    rainAudioContextRef.current = null;

    if (source) {
      try {
        source.stop();
      } catch {
        // ignore already-ended sources
      }
      source.disconnect();
    }

    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined);
    }
  };

  const toggleRainSound = async () => {
    if (!isRainScene) {
      return;
    }

    if (isRainSoundEnabled) {
      stopRainSound();
      setIsRainSoundEnabled(false);
      return;
    }

    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        setError('Your browser does not support the rain sound effect.');
        return;
      }

      const context = new AudioContextCtor();
      if (context.state === 'suspended') {
        await context.resume();
      }

      const buffer = await loadRainBuffer(context);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = buffer.duration;

      const gain = context.createGain();
      gain.gain.value = 0.55;

      source.connect(gain);
      gain.connect(context.destination);
      source.start();

      rainAudioContextRef.current = context;
      rainAudioSourceRef.current = source;
      setIsRainSoundEnabled(true);
    } catch {
      stopRainSound();
      setError('Unable to start rain sound right now.');
    }
  };

  useEffect(() => {
    if (!isForestScene && isForestSoundEnabled) {
      stopForestSound();
      setIsForestSoundEnabled(false);
    }
  }, [isForestScene, isForestSoundEnabled]);

  useEffect(() => {
    if (!isRainScene && isRainSoundEnabled) {
      stopRainSound();
      setIsRainSoundEnabled(false);
    }
  }, [isRainScene, isRainSoundEnabled]);

  useEffect(() => () => {
    stopForestSound();
    stopRainSound();
  }, []);

  return (
    <div className="app-shell">
      <header>
        <h1>Virtual Reading World</h1>
        <p className="app-tagline">Choose your spot, update your status, and read.</p>
      </header>

      {!profile ? (
        <>
          <main className="card">
            <form onSubmit={handleSubmit}>
              <label htmlFor="username">Enter a reader display name</label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="reader123"
                autoFocus
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Loading…' : 'Continue'}
              </button>
            </form>
            {error && <div className="error">{error}</div>}
          </main>
          <div className="login-links" aria-label="External links">
            <a
              href="https://www.threads.com/@tothemax2050"
              target="_blank"
              rel="noreferrer"
              aria-label="Open Threads page"
              title="My @Tothemax2050 Threads Page"
            >
              <img className="login-link-threads-icon" src={`${import.meta.env.BASE_URL}Threads.webp`} alt="" />
            </a>
            <a
              href="https://readingisalifestyle.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Open home page"
              title="My Reading Is A Lifestyle Homepage"
              className="login-link-image-link"
            >
              <img className="login-link-home-image" src={`${import.meta.env.BASE_URL}homepage.webp`} alt="" />
            </a>
          </div>
        </>
      ) : (
        <div className={`scene-shell ${isSceneExpanded ? 'scene-shell-immersive' : ''}`}>
          <section className={`scene-panel ${isSceneExpanded ? 'scene-panel-immersive' : ''}`} ref={sceneRef} onClick={handleSceneClick}>
            <img
              className={`scene-image ${selectedSceneOption.value === 'sunrise' || selectedSceneOption.value === 'night' ? 'scene-image-left-focus' : ''}`}
              src={scenePanelBackgroundImage}
              alt=""
            />
            <div className="scene-overlay" style={{ background: scenePanelOverlay }} />
            <button
              type="button"
              className="scene-fullscreen-toggle"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void toggleSceneFullscreen();
              }}
              aria-label={isSceneExpanded ? 'Restore page layout' : 'Expand reading scene'}
              title={isSceneExpanded ? 'Restore page layout' : 'Expand reading scene'}
            >
              <span className="scene-fullscreen-toggle-icon" aria-hidden="true">{isSceneExpanded ? '✕' : '⤢'}</span>
            </button>
            {(isForestScene || isRainScene) && (
              <button
                type="button"
                className={`scene-sound-toggle ${(isForestScene && isForestSoundEnabled) || (isRainScene && isRainSoundEnabled) ? 'scene-sound-toggle-on' : ''}`}
                aria-label={isForestScene
                  ? (isForestSoundEnabled ? 'Disable forest sound' : 'Enable forest sound')
                  : (isRainSoundEnabled ? 'Disable rain sound' : 'Enable rain sound')}
                title={isForestScene
                  ? (isForestSoundEnabled ? 'Disable forest sound' : 'Enable forest sound')
                  : (isRainSoundEnabled ? 'Disable rain sound' : 'Enable rain sound')}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (isForestScene) {
                    void toggleForestSound();
                    return;
                  }
                  void toggleRainSound();
                }}
              >
                <span className="scene-sound-toggle-icon" aria-hidden="true">
                  {(isForestScene && isForestSoundEnabled) || (isRainScene && isRainSoundEnabled) ? '🔊' : '🔈'}
                </span>
              </button>
            )}
            {announcementMessage && (
              <div className={`announcement-overlay announcement-overlay-${announcementVariant}`}>
                <div className="announcement-title">Announcements [{announcementDateLabel}]</div>
                <div className="announcement-message">{announcementMessage}</div>
              </div>
            )}
            {!profile.isObserver && (
              <div
                className={`avatar-wrapper current-reader ${avatarPosition.x > sceneWidth - 220 ? 'avatar-name-left' : ''}`}
                style={{
                  left: `${Math.min(Math.max(avatarPosition.x > sceneWidth - 220 ? avatarPosition.x - 170 : avatarPosition.x, 0), sceneWidth - 120)}px`,
                  top: `${avatarPosition.y}px`,
                }}
                onMouseEnter={() => handleAvatarMouseEnter(profile.username)}
                onMouseLeave={() => handleAvatarMouseLeave(profile.username)}
                onClick={(event) => handleAvatarClick(event, profile.username)}
              >
                <div className="avatar-anchor">
                  <div className={`avatar ${profile.isGhost ? 'avatar-ghost' : ''}`}>
                    {activeTooltipUsername === profile.username && !isReaderBetweenBooks(profile) && (
                      renderReaderTooltip(profile, currentTooltipClassName)
                    )}
                    {renderAvatarContent(profile, profile.isObserver ? '👀' : '📚')}
                    {renderReadingTimeBadge(profile)}
                    {isReaderBetweenBooks(profile) ? (
                      <span className="book-format-badge" role="img" aria-label="Between books" title="Between books">⏸</span>
                    ) : !profile.isGhost && (
                      <span className="book-format-badge" role="img" aria-label="format">
                        {formatBadgeEmoji(profile.books?.[profile.currentBookIndex]?.format ?? 'physical')}
                      </span>
                    )}
                    {chatPings.length > 0 && (
                      <button
                        type="button"
                        className="chat-bell-badge"
                        title={`Chat request from ${chatPings.map((ping) => ping.fromUsername).join(', ')}`}
                        aria-label={`Open live chat: request from ${chatPings.map((ping) => ping.fromUsername).join(', ')}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          acknowledgeChatPings();
                          setIsChatCollapsed(false);
                          focusChatComposer();
                        }}
                      >
                        <span aria-hidden="true">🔔</span>
                        {chatPings.length > 1 && <span className="chat-bell-count">{chatPings.length}</span>}
                      </button>
                    )}
                  </div>
                  <div className={`avatar-name ${profile.isGhost ? 'avatar-name-ghost' : ''}`}>{formatReaderBadgeLabel(profile.username, profile.status)}{renderStatusLike(profile, true)}</div>
                </div>
              </div>
            )}
            {otherReaders.map((reader) => {
              const renderedPosition = toRenderedPosition(reader.positionX, reader.positionY, sceneRef.current?.clientWidth ?? 640, sceneRef.current?.clientHeight ?? 520);
              const tooltipClassName = tooltipPlacementClass(getTooltipPlacement(renderedPosition, sceneWidth));
              const isNearRightEdge = renderedPosition.x > sceneWidth - 220;
              return (
                <div
                  key={reader.username}
                  className={`avatar-wrapper remote-avatar ${isNearRightEdge ? 'avatar-name-left' : ''}`}
                  style={{
                    left: `${Math.min(Math.max(isNearRightEdge ? renderedPosition.x - 170 : renderedPosition.x, 0), sceneWidth - 120)}px`,
                    top: `${renderedPosition.y}px`,
                  }}
                  onMouseEnter={() => handleAvatarMouseEnter(reader.username)}
                  onMouseLeave={() => handleAvatarMouseLeave(reader.username)}
                  onClick={(event) => handleAvatarClick(event, reader.username)}
                >
                  <div className="avatar-anchor">
                    <div className={`avatar remote-avatar-badge ${activeTooltipUsername === reader.username ? 'avatar-hovered' : ''} ${reader.isGhost ? 'avatar-ghost' : ''}`}>
                      {activeTooltipUsername === reader.username && !isReaderBetweenBooks(reader) && (
                        renderReaderTooltip(reader, tooltipClassName)
                      )}
                      {renderAvatarContent(reader, '📖')}
                      {renderReadingTimeBadge(reader)}
                      {isReaderBetweenBooks(reader) ? (
                        <span className="book-format-badge" role="img" aria-label="Between books" title="Between books">⏸</span>
                      ) : !reader.isGhost && (
                        <span className="book-format-badge" role="img" aria-label="format">
                          {formatBadgeEmoji(reader.books?.[reader.currentBookIndex]?.format ?? 'physical')}
                        </span>
                      )}
                    </div>
                    <div className={`avatar-name remote-avatar-name ${reader.isGhost ? 'avatar-name-ghost' : ''}`}>{formatReaderBadgeLabel(reader.username, reader.status)}{renderStatusLike(reader, false)}</div>
                  </div>
                </div>
              );
            })}
          </section>

          <aside className={`profile-card ${isProfileCollapsed ? 'profile-card-collapsed' : ''}`}>
            <div className="profile-card-header">
              <div className="profile-card-header-main">
                <h2>{`${profile.username}'s profile`}</h2>
                {!profile.isObserver && (
                  <div className="profile-field avatar-field compact-avatar-field">
                    <label>Avatar</label>
                    <div className="avatar-picker-wrap">
                      <button
                        type="button"
                        className="avatar-picker-button"
                        onClick={() => setAvatarMenuOpen((current) => !current)}
                        aria-expanded={avatarMenuOpen}
                        aria-label="Choose avatar icon or upload image"
                      >
                        {avatarPreviewValue}
                      </button>
                      {avatarMenuOpen && (
                        <div className="avatar-picker-menu" role="menu" aria-label="Avatar choices">
                          <div className="avatar-picker-grid">
                            {AVATAR_OPTIONS.map((icon) => (
                              <button
                                key={icon}
                                type="button"
                                className="avatar-picker-option"
                                onClick={() => {
                                  setAvatarIconDraft(icon);
                                  setAvatarImageData('');
                                  setAvatarMenuOpen(false);
                                }}
                              >
                                {icon}
                              </button>
                            ))}
                          </div>
                          <label className="avatar-picker-upload">
                            <input type="file" accept="image/*" onChange={handleAvatarUpload} />
                            Upload custom image
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="profile-card-controls">
                <button
                  type="button"
                  className="profile-collapse-button"
                  onClick={() => {
                    setAvatarMenuOpen(false);
                    setIsProfileCollapsed((current) => !current);
                  }}
                  aria-expanded={!isProfileCollapsed}
                  aria-controls="profile-editor-body"
                  aria-label={isProfileCollapsed ? 'Expand profile editor' : 'Minimize profile editor'}
                  title={isProfileCollapsed ? 'Expand profile editor' : 'Minimize profile editor'}
                >
                  {isProfileCollapsed ? '▢' : '—'}
                </button>
              </div>
            </div>
            {!isProfileCollapsed && profile.isObserver ? (
              <div className="profile-field">
                <label>Observer mode</label>
                <p>You are viewing the beach without a stored profile.</p>
              </div>
            ) : null}
            {!isProfileCollapsed && !profile.isObserver ? (
              <form id="profile-editor-body" onSubmit={saveProfile}>
                <div className="profile-field">
                  <label>Reading scene</label>
                  <div className="scene-option-buttons" role="group" aria-label="Reading scene options">
                    {SCENE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`scene-option-button ${(profileForm.backgroundScene || profile?.backgroundScene || 'ocean-beach') === option.value ? 'scene-option-button-active' : ''}`}
                        onClick={() => {
                          setProfileForm((current) => ({
                            ...current,
                            backgroundScene: option.value,
                          }));
                          setScenePreview(option.value);
                        }}
                      >
                        <span className="scene-option-button-main">
                          {option.icon && <span className="scene-option-button-icon" aria-hidden="true">{option.icon}</span>}
                          <span>{option.shortLabel}</span>
                        </span>
                        {option.badge && <span className="scene-option-button-badge" aria-hidden="true">{option.badge}</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="profile-section-card profile-status-section-card">
                  <div className="profile-field">
                    <label htmlFor="statusText">Reading status or mood</label>
                    <div
                      className="recent-status-control"
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                          setIsRecentStatusListOpen(false);
                        }
                      }}
                    >
                      <input
                        id="statusText"
                        className="status-text-input"
                        value={statusText}
                        onFocus={() => setIsRecentStatusListOpen(true)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            setIsRecentStatusListOpen(false);
                          }
                        }}
                        onChange={(event) => {
                          const nextStatus = event.target.value;
                          statusTextRef.current = nextStatus;
                          setStatusText(nextStatus);
                        }}
                        placeholder="in a coffee break"
                        maxLength={48}
                        autoComplete="off"
                        aria-haspopup={profile.recentStatuses?.length ? 'listbox' : undefined}
                        aria-expanded={profile.recentStatuses?.length ? isRecentStatusListOpen : undefined}
                        aria-controls={profile.recentStatuses?.length ? 'recent-status-options' : undefined}
                      />
                      {isRecentStatusListOpen && profile.recentStatuses && profile.recentStatuses.length > 0 && (
                        <div id="recent-status-options" className="recent-status-menu" role="listbox" aria-label="Recent statuses">
                          {profile.recentStatuses.map((recentStatus, index) => (
                            <button
                              key={`${recentStatus}-${index}`}
                              type="button"
                              className="recent-status-option"
                              role="option"
                              aria-selected={statusText === recentStatus}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                statusTextRef.current = recentStatus;
                                setStatusText(recentStatus);
                                setIsRecentStatusListOpen(false);
                              }}
                            >
                              {recentStatus}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="progress-hint">A short witty one-liner is ideal.</p>
                    <div className="profile-section-action-row">
                      <button
                        type="button"
                        className="secondary profile-partial-save-button"
                        onClick={() => {
                          void saveStatusAndMood();
                        }}
                        disabled={loading}
                      >
                        {loading ? 'Updating…' : 'Update'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="profile-section-card profile-about-me-section-card">
                  <h3>About me</h3>
                  <div className="profile-field">
                    <label htmlFor="aboutMeBio">Short bio</label>
                    <textarea
                      id="aboutMeBio"
                      value={profileForm.aboutMeBio}
                      maxLength={280}
                      rows={3}
                      placeholder="A little about you as a reader"
                      onChange={(event) => setProfileForm((current) => ({
                        ...current,
                        aboutMeBio: event.target.value.slice(0, 280),
                      }))}
                    />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="aboutMeLink">Link</label>
                    <input
                      id="aboutMeLink"
                      type="url"
                      value={profileForm.aboutMeLink}
                      maxLength={500}
                      placeholder="https://example.com"
                      onChange={(event) => setProfileForm((current) => ({
                        ...current,
                        aboutMeLink: event.target.value.slice(0, 500),
                      }))}
                    />
                  </div>
                  <div className="profile-section-action-row">
                    <button
                      type="button"
                      className="secondary profile-partial-save-button"
                      onClick={() => void saveAboutMe()}
                      disabled={loading}
                    >
                      {loading ? 'Updating…' : 'Update'}
                    </button>
                  </div>
                </div>
                <div className="profile-field profile-field-divider">
                  <div className="simple-divider" aria-hidden="true" />
                  <label>Editing current book</label>
                  <div className="book-slot-tabs" role="tablist" aria-label="Book slots">
                    {BOOK_SLOT_OPTIONS.map((slot) => (
                      <button
                        key={`book-slot-${slot.index}`}
                        type="button"
                        role="tab"
                        aria-selected={safeEditingBookIndex === slot.index}
                        className={`book-slot-tab ${safeEditingBookIndex === slot.index ? 'book-slot-tab-active' : ''}`}
                        onClick={() => {
                          setProfileForm((current) => ({
                            ...current,
                            editingBookIndex: slot.index,
                          }));
                        }}
                      >
                        {slot.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`book-slot-tab between-books-tab ${isEditingBetweenBooks ? 'book-slot-tab-active' : ''}`}
                      aria-label="Between books"
                      aria-pressed={isEditingBetweenBooks}
                      title="Between books"
                      onClick={() => {
                        setProfileForm((current) => ({
                          ...current,
                          editingBookIndex: BETWEEN_BOOKS_INDEX,
                        }));
                      }}
                    >
                      <span aria-hidden="true">⏸</span>
                    </button>
                  </div>
                </div>
                <div className="profile-section-card">
                  <p className="progress-hint">The selected editing slot is the current book shown in scene after save.</p>
                  <div className="book-editor-box">
                    <div className="book-editor-title">{isEditingBetweenBooks ? BETWEEN_BOOKS_TITLE : currentBookSlotLabels[safeEditingBookIndex] || `Book ${safeEditingBookIndex + 1}`}</div>
                    {isEditingBetweenBooks ? (
                      <p className="progress-hint">You are between books right now. Save or update to show this in the scene tooltip.</p>
                    ) : (
                      <>
                        <div className="profile-field">
                          <label htmlFor="bookFormat">Book format</label>
                          <select
                            id="bookFormat"
                            className="progress-mode-select"
                            value={editingBook.format}
                            onChange={(event) => {
                              const nextFormat = normalizeBookFormat(event.target.value);
                              setProfileForm((current) => {
                                const nextBooks = [...current.books];
                                const activeDraft = nextBooks[safeEditingBookIndex];
                                const previousMode = progressModeForFormat(activeDraft.format);
                                const nextMode = progressModeForFormat(nextFormat);
                                const currentValue = parseDraftProgress(activeDraft.currentProgress, previousMode);
                                const totalValue = parseDraftProgress(activeDraft.totalProgress, previousMode);

                                nextBooks[safeEditingBookIndex] = {
                                  ...activeDraft,
                                  format: nextFormat,
                                  currentProgress: formatProgressInput(currentValue ?? 0, nextMode),
                                  totalProgress: formatProgressInput(totalValue ?? 0, nextMode),
                                };

                                return {
                                  ...current,
                                  books: nextBooks,
                                };
                              });
                            }}
                          >
                            {BOOK_FORMAT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.emoji} {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="profile-field">
                          <label htmlFor="currentBook">Book title</label>
                          <input
                            id="currentBook"
                            value={editingBook.title}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setProfileForm((current) => {
                                const nextBooks = [...current.books];
                                nextBooks[safeEditingBookIndex] = {
                                  ...nextBooks[safeEditingBookIndex],
                                  title: nextValue,
                                };
                                return {
                                  ...current,
                                  books: nextBooks,
                                };
                              });
                            }}
                          />
                        </div>
                        <div className="profile-field">
                          <label htmlFor="currentAuthor">Author</label>
                          <input
                            id="currentAuthor"
                            value={editingBook.author}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setProfileForm((current) => {
                                const nextBooks = [...current.books];
                                nextBooks[safeEditingBookIndex] = {
                                  ...nextBooks[safeEditingBookIndex],
                                  author: nextValue,
                                };
                                return {
                                  ...current,
                                  books: nextBooks,
                                };
                              });
                            }}
                          />
                        </div>
                        <div className="profile-field book-cover-field">
                          <div className="book-cover-editor">
                            <div className="book-cover-heading-row">
                              <label htmlFor="bookCoverUpload">Book cover</label>
                              <label className="bulletin-image-upload-button book-cover-upload-button" htmlFor="bookCoverUpload">
                                {editingBook.imageData ? 'Update image' : 'Add image'}
                              </label>
                              <input
                                id="bookCoverUpload"
                                className="bulletin-image-upload-input"
                                type="file"
                                accept="image/*"
                                onChange={(event) => void handleBookCoverUpload(event, safeEditingBookIndex)}
                              />
                            </div>
                            {editingBook.imageData && (
                              <div className="book-cover-preview-row">
                                <img className="book-cover-preview" src={editingBook.imageData} alt={`Cover of ${editingBook.title || 'selected book'}`} />
                                <button
                                  type="button"
                                  className="bulletin-delete-button book-cover-remove-button"
                                  aria-label="Remove book cover image"
                                  title="Remove book cover image"
                                  onClick={() => setProfileForm((current) => ({
                                    ...current,
                                    books: current.books.map((book, index) => index === safeEditingBookIndex ? { ...book, imageData: '' } : book),
                                  }))}
                                >
                                  <span aria-hidden="true">🗑️</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="profile-field progress-field">
                          <label htmlFor="progressCurrent">Reading progress</label>
                          <div className="progress-controls">
                            <div className="progress-input-row">
                              <input
                                id="progressCurrent"
                                inputMode={editingBookMode === 'audio' ? 'text' : 'numeric'}
                                value={editingBook.currentProgress}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setProfileForm((current) => {
                                    const nextBooks = [...current.books];
                                    nextBooks[safeEditingBookIndex] = {
                                      ...nextBooks[safeEditingBookIndex],
                                      currentProgress: nextValue,
                                    };
                                    return {
                                      ...current,
                                      books: nextBooks,
                                    };
                                  });
                                }}
                                placeholder={editingBookMode === 'audio' ? '5h5m' : '100'}
                              />
                              <span className="progress-separator">/</span>
                              <input
                                id="progressTotal"
                                inputMode={editingBookMode === 'audio' ? 'text' : 'numeric'}
                                value={editingBook.totalProgress}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setProfileForm((current) => {
                                    const nextBooks = [...current.books];
                                    nextBooks[safeEditingBookIndex] = {
                                      ...nextBooks[safeEditingBookIndex],
                                      totalProgress: nextValue,
                                    };
                                    return {
                                      ...current,
                                      books: nextBooks,
                                    };
                                  });
                                }}
                                placeholder={editingBookMode === 'audio' ? '10h30m' : '400'}
                              />
                              <span className="progress-percent progress-percent-readonly" title="Completion (read only)" aria-label={`Completion ${editingProgressPercent ?? 'unknown'}`}>
                                {editingProgressPercent ?? '—'}
                              </span>
                            </div>
                          </div>
                          <p className="progress-hint">
                            {editingBookMode === 'audio'
                              ? 'Enter minutes or h/m format (e.g. 5h5m / 10h30m).'
                              : 'Enter page counts (e.g. 100 / 400).'}
                          </p>
                        </div>
                        <div className="profile-field book-feeling-field">
                          <label htmlFor="bookFeeling">How are you feeling about this book?</label>
                          <input
                            id="bookFeeling"
                            type="text"
                            maxLength={160}
                            value={editingBook.feeling}
                            placeholder="A quick thought about the book so far"
                            onChange={(event) => {
                              const nextValue = event.target.value.replace(/[\r\n]+/g, ' ').slice(0, 160);
                              setProfileForm((current) => {
                                const nextBooks = [...current.books];
                                nextBooks[safeEditingBookIndex] = {
                                  ...nextBooks[safeEditingBookIndex],
                                  feeling: nextValue,
                                };
                                return {
                                  ...current,
                                  books: nextBooks,
                                };
                              });
                            }}
                          />
                        </div>
                        <div className="profile-field rating-field">
                          <label htmlFor="bookRating">Current rating</label>
                          <div className="rating-control">
                            <input
                              id="bookRating"
                              className="rating-slider"
                              type="range"
                              min={0}
                              max={5}
                              step={0.5}
                              value={currentRatingValue}
                              style={ratingSliderStyle}
                              onChange={(event) => {
                                const nextValue = Number(event.target.value);
                                setProfileForm((current) => {
                                  const nextBooks = [...current.books];
                                  nextBooks[safeEditingBookIndex] = {
                                    ...nextBooks[safeEditingBookIndex],
                                    currentRating: normalizeRating(nextValue),
                                  };
                                  return {
                                    ...current,
                                    books: nextBooks,
                                  };
                                });
                              }}
                              aria-label="Current book rating"
                            />
                            <div className="rating-display-row">
                              <div className="rating-stars" aria-hidden="true">
                                {Array.from({ length: 5 }, (_, index) => {
                                  const starValue = index + 1;
                                  const rating = normalizeRating(editingBook.currentRating ?? 0);
                                  const partialFill = rating > index && rating < starValue;
                                  const fillPercent = partialFill ? ((rating - index) * 100) : 0;
                                  const filled = rating >= starValue;

                                  return (
                                    <span
                                      key={`rating-star-${starValue}`}
                                      className={`rating-star ${filled ? 'rating-star-filled' : partialFill ? 'rating-star-half' : 'rating-star-empty'}`}
                                      style={partialFill ? { ['--fill-percent' as string]: `${fillPercent}%` } : undefined}
                                    >
                                      ★
                                    </span>
                                  );
                                })}
                              </div>
                              <div className="rating-readout">{formatRatingLabel(normalizeRating(editingBook.currentRating ?? 0))}</div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="profile-section-action-row">
                    <button
                      type="button"
                      className="secondary profile-partial-save-button"
                      onClick={() => {
                        void saveBookInformation();
                      }}
                      disabled={loading}
                    >
                      {loading ? 'Updating…' : 'Update'}
                    </button>
                  </div>
                </div>
                <button type="submit" className="profile-save-button" disabled={loading}>
                  {loading ? 'Saving…' : 'Update profile'}
                </button>
              </form>
            ) : null}
            {!isProfileCollapsed && profile.isObserver && (
              <div>
                When space opens up in the active reader list, you can leave and rejoin as an active reader.
              </div>
            )}
          </aside>

          {!profile.isObserver && (
            <section ref={chatBoardRef} className={`bulletin-board chat-board ${isChatCollapsed ? 'bulletin-board-collapsed' : ''}`} aria-label="Live book chat">
              <div className="bulletin-board-header">
                <div className="bulletin-board-header-main">
                  <h3>Live Book Chat</h3>
                  <p>Talk about books in real time. Cleared every day.</p>
                </div>
                <button
                  type="button"
                  className="profile-collapse-button"
                  onClick={() => {
                    if (isChatCollapsed) {
                      acknowledgeChatPings();
                    }
                    setIsChatCollapsed((current) => !current);
                  }}
                  aria-expanded={!isChatCollapsed}
                  aria-controls="chat-board-body"
                  aria-label={isChatCollapsed ? 'Expand live chat' : 'Minimize live chat'}
                  title={isChatCollapsed ? 'Expand live chat' : 'Minimize live chat'}
                >
                  {isChatCollapsed ? '▢' : '—'}
                </button>
              </div>

              {!isChatCollapsed && (
                <div id="chat-board-body" className="bulletin-board-body">
                  <div
                    ref={chatFeedRef}
                    className="bulletin-feed chat-feed"
                    role="log"
                    aria-live="polite"
                    onScroll={(event) => {
                      chatStickToBottomRef.current = event.currentTarget.scrollTop < 40;
                    }}
                  >
                    {chatMessages.length === 0 ? (
                      <p className="bulletin-empty">No messages yet today. Say hello, or click Chat on a reader&apos;s book in the scene.</p>
                    ) : (
                      [...chatMessages].reverse().map((message) => (
                        <article
                          key={`${message.dayKey}-${message.messageId}`}
                          className={`bulletin-post chat-message ${message.author === profile.username ? 'chat-message-own' : ''} ${message.toUsername === profile.username ? 'chat-message-to-me' : ''}`}
                          role="article"
                          aria-label={message.toUsername ? `Message from ${message.author} to ${message.toUsername}` : `Message from ${message.author}`}
                        >
                          <div className="bulletin-post-meta">
                            <div className="bulletin-author-wrap">
                              <span className="bulletin-avatar" aria-hidden="true">
                                {message.avatarImageData ? (
                                  <img className="bulletin-avatar-image" src={message.avatarImageData} alt="" />
                                ) : (
                                  <span className="bulletin-avatar-emoji">{message.avatarIcon || '📚'}</span>
                                )}
                              </span>
                              <span className="bulletin-author-name">{message.author}</span>
                              {message.toUsername && (
                                <>
                                  <span className="chat-arrow" aria-hidden="true">→</span>
                                  <span className="bulletin-avatar" aria-hidden="true">
                                    {message.toAvatarImageData ? (
                                      <img className="bulletin-avatar-image" src={message.toAvatarImageData} alt="" />
                                    ) : (
                                      <span className="bulletin-avatar-emoji">{message.toAvatarIcon || '📚'}</span>
                                    )}
                                  </span>
                                  <span className="bulletin-author-name">{message.toUsername}</span>
                                </>
                              )}
                              <span className="bulletin-post-id">#{message.messageId}</span>
                            </div>
                            <span className="bulletin-post-time">{formatRelativeTime(message.createdAt, browserNow)}</span>
                          </div>
                          {message.toUsername && message.bookTitle && (
                            <p className="chat-message-book">about Book &ldquo;{message.bookTitle}&rdquo;</p>
                          )}
                          <div className={`bulletin-post-content ${message.imageData ? 'bulletin-post-content-has-image' : ''}`}>
                            {message.text && <p className="bulletin-post-text">{message.text}</p>}
                            {message.imageData && (
                              <button
                                type="button"
                                className="bulletin-post-image-button"
                                onClick={() => setExpandedBulletinImage(message.imageData)}
                                aria-label={`Open image from ${message.author}`}
                              >
                                <img className="bulletin-post-image" src={message.imageData} alt={`Chat image by ${message.author}`} />
                              </button>
                            )}
                          </div>
                          <div className="bulletin-like-row">
                            {message.author === profile.username && (
                              <button
                                type="button"
                                className="bulletin-delete-button"
                                onClick={(event) => deleteOwnChatMessage(event, message)}
                                disabled={pendingChatDeleteId === message.messageId}
                                aria-label="Delete this message"
                                title="Delete this message"
                              >
                                {pendingChatDeleteId === message.messageId ? '…' : '🗑️'}
                              </button>
                            )}
                            <button
                              type="button"
                              className={`bulletin-like-button ${likedChatSessionKeys.has(`${message.dayKey}:${message.messageId}`) ? 'bulletin-like-button-done' : ''}`}
                              onClick={(event) => toggleChatMessageLike(event, message)}
                              disabled={pendingChatLikeId === message.messageId || pendingChatDeleteId === message.messageId}
                              aria-label={likedChatSessionKeys.has(`${message.dayKey}:${message.messageId}`) ? 'Unlike this message' : 'Like this message'}
                            >
                              {likedChatSessionKeys.has(`${message.dayKey}:${message.messageId}`) ? '♥' : '♡'}
                            </button>
                            <span className="bulletin-like-count" aria-live="polite">{message.likeCount}</span>
                          </div>
                        </article>
                      ))
                    )}
                  </div>

                  <form className="bulletin-composer" onSubmit={submitChatMessage}>
                    <div className="chat-target">
                      <label className="chat-target-label" htmlFor="chatRecipient">To</label>
                      {chatTarget && (
                        <span className="bulletin-avatar" aria-hidden="true">
                          {chatTarget.avatarImageData ? (
                            <img className="bulletin-avatar-image" src={chatTarget.avatarImageData} alt="" />
                          ) : (
                            <span className="bulletin-avatar-emoji">{chatTarget.avatarIcon || '📚'}</span>
                          )}
                        </span>
                      )}
                      <select
                        id="chatRecipient"
                        className="chat-target-select"
                        value={chatTarget?.username ?? ''}
                        onChange={(event) => handleChatRecipientChange(event.target.value)}
                      >
                        <option value="">Everyone</option>
                        {chatRecipientGroups.wroteToYou.length > 0 && (
                          <optgroup label="Wrote to you">
                            {chatRecipientGroups.wroteToYou.map((name) => (
                              <option key={`wrote-${name}`} value={name}>{chatPresentNames.has(name) ? name : `${name} (not here now)`}</option>
                            ))}
                          </optgroup>
                        )}
                        {chatRecipientGroups.active.length > 0 && (
                          <optgroup label="Active readers">
                            {chatRecipientGroups.active.map((name) => (
                              <option key={`active-${name}`} value={name}>{name}</option>
                            ))}
                          </optgroup>
                        )}
                        {chatRecipientGroups.ghosts.length > 0 && (
                          <optgroup label="Away readers">
                            {chatRecipientGroups.ghosts.map((name) => (
                              <option key={`ghost-${name}`} value={name}>{name}</option>
                            ))}
                          </optgroup>
                        )}
                        {chatRecipientGroups.visitedToday.length > 0 && (
                          <optgroup label="Visited today">
                            {chatRecipientGroups.visitedToday.map((name) => (
                              <option key={`visited-${name}`} value={name}>{name}</option>
                            ))}
                          </optgroup>
                        )}
                        {chatRecipientGroups.others.length > 0 && (
                          <optgroup label="Others in today's chat">
                            {chatRecipientGroups.others.map((name) => (
                              <option key={`other-${name}`} value={name}>{name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {chatTarget?.bookTitle && (
                        <span className="chat-target-book">about Book &ldquo;{chatTarget.bookTitle}&rdquo;</span>
                      )}
                    </div>
                    <label htmlFor="chatText">Message</label>
                    <textarea
                      id="chatText"
                      ref={chatTextareaRef}
                      value={chatDraft}
                      onChange={(event) => setChatDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                          event.preventDefault();
                          void submitChatMessage();
                        }
                      }}
                      maxLength={800}
                      rows={3}
                      placeholder="Chat about a book... (Enter to send, Shift+Enter for a new line)"
                    />
                    <div className="bulletin-image-upload-row">
                      <label className="bulletin-image-upload-button" htmlFor="chatImageUpload">Add image</label>
                      <input
                        id="chatImageUpload"
                        className="bulletin-image-upload-input"
                        type="file"
                        accept="image/*"
                        onChange={handleChatImageUpload}
                      />
                      {chatImageDraft && (
                        <button
                          type="button"
                          className="bulletin-image-remove-button"
                          onClick={() => setChatImageDraft('')}
                        >
                          Remove image
                        </button>
                      )}
                    </div>
                    {chatImageDraft && (
                      <button
                        type="button"
                        className="bulletin-image-preview-card"
                        onClick={() => setExpandedBulletinImage(chatImageDraft)}
                        aria-label="Open selected chat image"
                      >
                        <img className="bulletin-image-preview" src={chatImageDraft} alt="Selected chat upload" />
                      </button>
                    )}
                    <div className="bulletin-composer-actions">
                      <span className="bulletin-char-count">{chatDraft.trim().length}/800</span>
                      <button type="submit" disabled={isPostingChat || (!chatDraft.trim() && !chatImageDraft)}>
                        {isPostingChat ? 'Posting…' : 'Post'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </section>
          )}

          <section className={`bulletin-board ${isBulletinCollapsed ? 'bulletin-board-collapsed' : ''}`} aria-label="Daily bulletin board">
            <div className="bulletin-board-header">
              <div className="bulletin-board-header-main">
                <h3>Daily Bulletin Board</h3>
                <p>Posts stay for two days. Newest posts appear first.</p>
              </div>
              <button
                type="button"
                className="profile-collapse-button"
                onClick={() => setIsBulletinCollapsed((current) => !current)}
                aria-expanded={!isBulletinCollapsed}
                aria-controls="bulletin-board-body"
                aria-label={isBulletinCollapsed ? 'Expand bulletin board' : 'Minimize bulletin board'}
                title={isBulletinCollapsed ? 'Expand bulletin board' : 'Minimize bulletin board'}
              >
                {isBulletinCollapsed ? '▢' : '—'}
              </button>
            </div>

            {!isBulletinCollapsed && (
              <div id="bulletin-board-body" className="bulletin-board-body">
                <div className="bulletin-feed" role="feed" aria-live="polite">
                  {bulletinPosts.length === 0 ? (
                    <p className="bulletin-empty">No posts yet today. Be the first to share.</p>
                  ) : (
                    bulletinPosts.map((post) => {
                      const likeKey = `${post.dayKey}:${post.postId}`;
                      const liked = likedBulletinSessionKeys.has(likeKey);
                      const likePending = pendingBulletinLikeKey === likeKey;
                      const deletePending = pendingBulletinDeleteKey === likeKey;
                      const canDelete = profile?.username === post.author;
                      return (
                        <article key={`${post.dayKey}-${post.postId}`} className="bulletin-post" role="article" aria-label={`Post ${post.postId}`}>
                          <div className="bulletin-post-meta">
                            <div className="bulletin-author-wrap">
                              <span className="bulletin-avatar" aria-hidden="true">
                                {post.avatarImageData ? (
                                  <img className="bulletin-avatar-image" src={post.avatarImageData} alt="" />
                                ) : (
                                  <span className="bulletin-avatar-emoji">{post.avatarIcon || '📚'}</span>
                                )}
                              </span>
                              <span className="bulletin-author-name">{post.author}</span>
                              <span className="bulletin-post-id">#{post.postId}</span>
                            </div>
                            <span className="bulletin-post-time">{formatRelativeTime(post.createdAt, browserNow)}</span>
                          </div>
                          <div className={`bulletin-post-content ${post.imageData ? 'bulletin-post-content-has-image' : ''}`}>
                            {post.text && <p className="bulletin-post-text">{post.text}</p>}
                            {post.imageData && (
                              <button
                                type="button"
                                className="bulletin-post-image-button"
                                onClick={() => setExpandedBulletinImage(post.imageData)}
                                aria-label={`Open image from post ${post.postId}`}
                              >
                                <img className="bulletin-post-image" src={post.imageData} alt={`Bulletin post by ${post.author}`} />
                              </button>
                            )}
                          </div>
                          <div className="bulletin-like-row">
                            {canDelete && (
                              <button
                                type="button"
                                className="bulletin-delete-button"
                                onClick={(event) => deleteOwnBulletinPost(event, post)}
                                disabled={deletePending}
                                aria-label="Delete this post"
                                title="Delete this post"
                              >
                                {deletePending ? '…' : '🗑️'}
                              </button>
                            )}
                            <button
                              type="button"
                              className={`bulletin-like-button ${liked ? 'bulletin-like-button-done' : ''}`}
                              onClick={(event) => toggleBulletinPostLike(event, post)}
                              disabled={likePending || deletePending}
                              aria-label={liked ? 'Unlike this post' : 'Like this post'}
                            >
                              {liked ? '♥' : '♡'}
                            </button>
                            <span className="bulletin-like-count" aria-live="polite">{post.likeCount}</span>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>

                <form className="bulletin-composer" onSubmit={submitBulletinPost}>
                  <label htmlFor="bulletinText">Post to today&apos;s board</label>
                  <textarea
                    id="bulletinText"
                    value={bulletinDraft}
                    onChange={(event) => setBulletinDraft(event.target.value)}
                    maxLength={800}
                    rows={3}
                    placeholder="Share a reading update, quote, quick note, or pair it with one image..."
                  />
                  <div className="bulletin-image-upload-row">
                    <label className="bulletin-image-upload-button" htmlFor="bulletinImageUpload">Add image</label>
                    <input
                      id="bulletinImageUpload"
                      className="bulletin-image-upload-input"
                      type="file"
                      accept="image/*"
                      onChange={handleBulletinImageUpload}
                    />
                    {bulletinImageDraft && (
                      <button
                        type="button"
                        className="bulletin-image-remove-button"
                        onClick={() => setBulletinImageDraft('')}
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                  {bulletinImageDraft && (
                    <button
                      type="button"
                      className="bulletin-image-preview-card"
                      onClick={() => setExpandedBulletinImage(bulletinImageDraft)}
                      aria-label="Open selected bulletin image"
                    >
                      <img className="bulletin-image-preview" src={bulletinImageDraft} alt="Selected bulletin upload" />
                    </button>
                  )}
                  <div className="bulletin-composer-actions">
                    <span className="bulletin-char-count">{bulletinDraft.trim().length}/800</span>
                    <button type="submit" disabled={isPostingBulletin || (!bulletinDraft.trim() && !bulletinImageDraft)}>
                      {isPostingBulletin ? 'Posting…' : 'Post'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>

          {expandedBulletinImage && (
            <div className="bulletin-image-modal" role="dialog" aria-modal="true" aria-label="Bulletin image viewer" onClick={() => setExpandedBulletinImage(null)}>
              <div className="bulletin-image-modal-dialog" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="bulletin-image-modal-close"
                  onClick={() => setExpandedBulletinImage(null)}
                  aria-label="Close bulletin image"
                >
                  ✕
                </button>
                <img className="bulletin-image-modal-image" src={expandedBulletinImage} alt="Expanded bulletin post" />
              </div>
            </div>
          )}

          <section className={`stats-card ${isStatsCollapsed ? 'stats-card-collapsed' : ''}`} aria-label="Daily statistics">
            <div className="stats-card-header">
              <h3>Statistics</h3>
              <button
                type="button"
                className="profile-collapse-button"
                onClick={() => setIsStatsCollapsed((current) => !current)}
                aria-expanded={!isStatsCollapsed}
                aria-controls="statistics-panel-body"
                aria-label={isStatsCollapsed ? 'Expand statistics' : 'Minimize statistics'}
                title={isStatsCollapsed ? 'Expand statistics' : 'Minimize statistics'}
              >
                {isStatsCollapsed ? '▢' : '—'}
              </button>
            </div>
            {!isStatsCollapsed && (
              <div id="statistics-panel-body" className="stats-grid">
                <div className="stats-item">
                  <span className="stats-label">Daily visits</span>
                  <span className="stats-value">{dailyVisits}</span>
                </div>
                <div className="stats-item">
                  <span className="stats-label">Daily users</span>
                  <span className="stats-value">{dailyUsers}</span>
                </div>
                <div className="stats-item">
                  <span className="stats-label">Reading time (all)</span>
                  <span className="stats-value">{formatMinutesToDuration(totalReadingMinutes)}</span>
                </div>
                <div className="stats-item">
                  <span className="stats-label">Active users</span>
                  <span className="stats-value">{activeReaderCount} / {activeReaderLimit}</span>
                </div>
                <div className="stats-item">
                  <span className="stats-label">Observers</span>
                  <span className="stats-value">{observerCount}</span>
                </div>
              </div>
            )}
            {!isStatsCollapsed && !profile.isObserver && (
              <div className="stats-day-streak">
                <span className="stats-label">Day streak</span>
                <span className="stats-day-streak-value">
                  <span aria-hidden="true">🔥</span>
                  {Math.max(0, Math.floor(Number(profile.dayStreak) || 0))}
                </span>
              </div>
            )}
            {!isStatsCollapsed && (
              <div className="stats-top-readers">
                <span className="stats-label">Daily top readers</span>
                <ul className="stats-top-readers-list">
                  {['🥇', '🥈', '🥉'].map((medal, index) => {
                    const reader = topDailyReaders[index];
                    return (
                      <li key={medal} className="stats-top-readers-row">
                        <span className="stats-top-readers-medal" aria-hidden="true">{medal}</span>
                        <span className="stats-top-readers-name">{reader?.username ?? ''}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          <div className="app-leave-row">
            <button
              type="button"
              className="secondary app-leave-button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void handleLeave();
              }}
            >
              Leave the world, keep the story.
            </button>
          </div>

          <div className="login-links app-links" aria-label="External links">
            <a
              href="https://www.threads.com/@tothemax2050"
              target="_blank"
              rel="noreferrer"
              aria-label="Open Threads page"
              title="My @Tothemax2050 Threads Page"
            >
              <img className="login-link-threads-icon" src={`${import.meta.env.BASE_URL}Threads.webp`} alt="" />
            </a>
            <a
              href="https://readingisalifestyle.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Open home page"
              title="My Reading Is A Lifestyle Homepage"
              className="login-link-image-link"
            >
              <img className="login-link-home-image" src={`${import.meta.env.BASE_URL}homepage.webp`} alt="" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

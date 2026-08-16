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
  favoriteAuthors: string[];
  status: string;
  positionX: number;
  positionY: number;
  avatarIcon: string;
  backgroundScene?: string;
  isActive: boolean;
  isObserver?: boolean;
};

type SceneReader = Profile;
type LoginMode = 'reader' | 'observer';

const AVATAR_SIZE = 48;
const DEFAULT_POSITION = { x: 50, y: 50 };
const DEFAULT_NORMALIZED_POSITION = { x: 0.5, y: 0.5 };
const POSITION_SCALE = 10000;
const AVATAR_OPTIONS = ['📚', '📗', '📒', '📕', '📙', '📓', '🧠', '🦉', '🐰', '🧶', '🗂️', '📜', '🪶', '☕', '🍵', '🐶', '🐱'];
const SCENE_OPTIONS = [
  {
    label: 'Ocean beach',
    shortLabel: 'Ocean',
    value: 'ocean-beach',
    imagePath: 'ocean-beach.jpg',
    overlay: 'linear-gradient(135deg, rgba(10, 45, 74, 0.2), rgba(61, 152, 208, 0.2))',
  },
  {
    label: 'Lush forest',
    shortLabel: 'Forest',
    value: 'lush-forest',
    imagePath: 'lush-forest.jpg',
    overlay: 'linear-gradient(135deg, rgba(17, 42, 34, 0.35), rgba(91, 139, 77, 0.3))',
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
];
type ProgressMode = 'pages' | 'audio';
type BookFormat = 'physical' | 'ebook' | 'audiobook';

type ProfileBook = {
  title: string;
  author: string;
  currentProgress: number;
  totalProgress: number;
  format: BookFormat;
  progressMode: ProgressMode;
};

type ProfileBookDraft = {
  title: string;
  author: string;
  currentProgress: string;
  totalProgress: string;
  format: BookFormat;
};

type TooltipPlacement = {
  vertical: 'top' | 'bottom';
  horizontal: 'left' | 'center' | 'right';
};

type AnnouncementPayload = {
  message?: string;
};

const OUTDOOR_SCENES = new Set(['ocean-beach', 'lush-forest', 'mountain-range', 'lake']);

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

function createObserverProfile(username: string): Profile {
  const books: ProfileBook[] = [
    { title: 'Observing', author: '—', currentProgress: 0, totalProgress: 0, format: 'physical', progressMode: 'pages' },
    { title: '', author: '', currentProgress: 0, totalProgress: 0, format: 'physical', progressMode: 'pages' },
    { title: '', author: '', currentProgress: 0, totalProgress: 0, format: 'physical', progressMode: 'pages' },
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

function normalizeIncomingBooks(profile: Partial<Profile>): { books: ProfileBook[]; currentBookIndex: number } {
  const fallbackBook: ProfileBook = {
    title: profile.currentBook || 'Untitled Beach Read',
    author: profile.currentAuthor || 'Unknown Author',
    currentProgress: Math.max(0, Math.floor(Number(profile.currentPage ?? 0))),
    totalProgress: Math.max(0, Math.floor(Number(profile.totalPageCount ?? 0))),
    format: profile.progressMode === 'audio' ? 'audiobook' : 'physical',
    progressMode: profile.progressMode === 'audio' ? 'audio' : 'pages',
  };

  const sourceBooks = Array.isArray(profile.books) ? profile.books : [];
  const books: ProfileBook[] = Array.from({ length: 3 }, (_unused, index) => {
    const source = sourceBooks[index];
    const fallback = index === 0 ? fallbackBook : createDefaultBook(index);
    const format = normalizeBookFormat(source?.format ?? fallback.format);
    const progressMode = progressModeForFormat(format);
    const currentProgress = Number(source?.currentProgress ?? fallback.currentProgress ?? 0);
    const totalProgress = Number(source?.totalProgress ?? fallback.totalProgress ?? 0);

    return {
      title: typeof source?.title === 'string' ? source.title : fallback.title,
      author: typeof source?.author === 'string' ? source.author : fallback.author,
      currentProgress: Number.isFinite(currentProgress) && currentProgress >= 0 ? Math.floor(currentProgress) : 0,
      totalProgress: Number.isFinite(totalProgress) && totalProgress >= 0 ? Math.floor(totalProgress) : 0,
      format,
      progressMode,
    };
  });

  const currentBookIndex = clampBookIndex(profile.currentBookIndex ?? 0);
  return { books, currentBookIndex };
}

function profileToBookDrafts(books: ProfileBook[]): ProfileBookDraft[] {
  return books.map((book) => ({
    title: book.title,
    author: book.author,
    format: book.format,
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

function progressLabel(mode: ProgressMode): string {
  return mode === 'audio' ? 'Time' : 'Page';
}

function App() {
  const [username, setUsername] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState({
    books: profileToBookDrafts([createDefaultBook(0), createDefaultBook(1), createDefaultBook(2)]),
    editingBookIndex: 0,
    favoriteAuthors: '',
    backgroundScene: 'ocean-beach',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarPosition, setAvatarPosition] = useState(DEFAULT_POSITION);
  const [statusText, setStatusText] = useState('Reading');
  const [scenePreview, setScenePreview] = useState('ocean-beach');
  const [avatarIconDraft, setAvatarIconDraft] = useState('📚');
  const [hoveredReaderUsername, setHoveredReaderUsername] = useState<string | null>(null);
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [otherReaders, setOtherReaders] = useState<SceneReader[]>([]);
  const [activeReaderLimit, setActiveReaderLimit] = useState(10);
  const [observerCount, setObserverCount] = useState(0);
  const [loginMode, setLoginMode] = useState<LoginMode>('reader');
  const sceneRef = useRef<HTMLDivElement>(null);
  const sceneSizeRef = useRef<{ width: number; height: number } | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const pollVersionRef = useRef(0);
  const suppressProfileStateRef = useRef(false);
  const sessionVersionRef = useRef(0);

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
            });
            setStatusText(observerProfile.status || 'Reading');
            setAvatarPosition(toRenderedPosition(observerProfile.positionX, observerProfile.positionY, sceneRef.current?.clientWidth ?? 640, sceneRef.current?.clientHeight ?? 520));
            localStorage.setItem('vwr-login-mode', 'observer');
            void loadOtherReaders(storedName);
            void loadObserverCount();
          }
        });
      } else {
        void loadProfile(storedName);
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
    if (profile) {
      const { books, currentBookIndex } = normalizeIncomingBooks(profile);
      setProfileForm((current) => ({
        ...current,
        books: profileToBookDrafts(books),
        editingBookIndex: currentBookIndex,
        favoriteAuthors: profile.favoriteAuthors.join(', '),
        backgroundScene: current.backgroundScene || profile.backgroundScene || 'ocean-beach',
      }));
      setStatusText(profile.status || 'Reading');
      setScenePreview(profile.backgroundScene || 'ocean-beach');
      setAvatarIconDraft((current) => current === '📚' ? (profile.avatarIcon || '📚') : current);
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

    const markInactiveOnUnload = () => {
      const currentProfile = profileRef.current ?? profile;
      if (!currentProfile || currentProfile.isObserver) {
        return;
      }

      const path = apiUrl(`/api/profile/${encodeURIComponent(currentProfile.username)}/deactivate`);
      const payload = JSON.stringify({ username: currentProfile.username });

      try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          const body = new Blob([payload], { type: 'application/json' });
          if (navigator.sendBeacon(path, body)) {
            return;
          }
        }
      } catch {
        // Fall back to keepalive fetch if beacon is unavailable.
      }

      void fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    };

    window.addEventListener('pagehide', markInactiveOnUnload);
    window.addEventListener('beforeunload', markInactiveOnUnload);

    return () => {
      window.removeEventListener('pagehide', markInactiveOnUnload);
      window.removeEventListener('beforeunload', markInactiveOnUnload);
    };

  }, [profile?.username, profile?.isObserver]);

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
        setProfile((current) => (current ? { ...current, ...normalizedProfile, avatarIcon: data.avatarIcon || current.avatarIcon } : normalizedProfile));
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

  const refreshSceneData = (usernameOverride?: string) => {
    void loadActiveReaderLimit();
    void loadObserverCount();

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

  const persistProfile = async (overrides: Partial<Profile> = {}) => {
    const currentProfile = profileRef.current ?? profile;
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

    const normalizedBooks: ProfileBook[] = [];
    for (let index = 0; index < profileForm.books.length; index += 1) {
      const draft = profileForm.books[index];
      const mode = progressModeForFormat(draft.format);
      const currentProgress = parseDraftProgress(draft.currentProgress, mode);
      const totalProgress = parseDraftProgress(draft.totalProgress, mode);

      if (currentProgress === null || totalProgress === null) {
        setError(mode === 'audio'
          ? `Book ${index + 1} progress must be minutes or h/m format (e.g. 5h5m).`
          : `Book ${index + 1} progress must be a valid non-negative page count.`);
        return null;
      }

      normalizedBooks.push({
        title: draft.title,
        author: draft.author,
        format: draft.format,
        progressMode: mode,
        currentProgress,
        totalProgress,
      });
    }

    const safeCurrentBookIndex = safeEditingBookIndex;
    const selectedBook = normalizedBooks[safeCurrentBookIndex] ?? normalizedBooks[0];

    const favoriteAuthors = profileForm.favoriteAuthors
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const nextStatus = statusText.trim() || 'Reading';
    const nextAvatarIcon = overrides.avatarIcon ?? avatarIconDraft ?? currentProfile.avatarIcon ?? '📚';
    const sceneWidth = sceneRef.current?.clientWidth ?? 640;
    const sceneHeight = sceneRef.current?.clientHeight ?? 520;
    const normalizedAvatarPosition = toStoredPosition(avatarPosition, sceneWidth, sceneHeight);

    setLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl(`/api/profile/${encodeURIComponent(currentProfile.username)}?ts=${Date.now()}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          books: normalizedBooks,
          currentBookIndex: safeCurrentBookIndex,
          currentBook: selectedBook?.title ?? currentProfile.currentBook,
          currentAuthor: selectedBook?.author ?? currentProfile.currentAuthor,
          currentPage: selectedBook?.currentProgress ?? currentProfile.currentPage,
          totalPageCount: selectedBook?.totalProgress ?? currentProfile.totalPageCount,
          progressMode: selectedBook?.progressMode ?? currentProfile.progressMode,
          favoriteAuthors,
          status: nextStatus,
          backgroundScene: profileForm.backgroundScene || currentProfile.backgroundScene || 'ocean-beach',
          avatarIcon: nextAvatarIcon,
          ...(overrides.isActive !== undefined ? { isActive: overrides.isActive } : {}),
          positionX: overrides.positionX !== undefined ? overrides.positionX : normalizedAvatarPosition.x,
          positionY: overrides.positionY !== undefined ? overrides.positionY : normalizedAvatarPosition.y,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || 'Unable to save profile.');
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

      const savedScene = data?.backgroundScene || profileForm.backgroundScene || currentProfile.backgroundScene || 'ocean-beach';
      const normalizedIncoming = normalizeIncomingBooks(data as Partial<Profile>);
      const savedBook = normalizedIncoming.books[normalizedIncoming.currentBookIndex] ?? normalizedIncoming.books[0];
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
        };
        return {
          ...merged,
          avatarIcon: data.avatarIcon || current?.avatarIcon || merged.avatarIcon,
        } as Profile;
      });
      setAvatarIconDraft(data?.avatarIcon || nextAvatarIcon || currentProfile.avatarIcon || '📚');
      setProfileForm((current) => ({
        ...current,
        books: profileToBookDrafts(normalizedIncoming.books),
        editingBookIndex: normalizedIncoming.currentBookIndex,
        backgroundScene: savedScene,
      }));
      setScenePreview(savedScene);
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
    const normalizedBooks: ProfileBook[] = profileForm.books.map((draft) => {
      const mode = progressModeForFormat(draft.format);
      return {
        title: draft.title,
        author: draft.author,
        format: draft.format,
        progressMode: mode,
        currentProgress: parseDraftProgress(draft.currentProgress, mode) ?? 0,
        totalProgress: parseDraftProgress(draft.totalProgress, mode) ?? 0,
      };
    });
    const safeCurrentBookIndex = safeEditingBookIndex;
    const selectedBook = normalizedBooks[safeCurrentBookIndex] ?? normalizedBooks[0];
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
        currentBook: selectedBook?.title ?? leavingProfile.currentBook,
        currentAuthor: selectedBook?.author ?? leavingProfile.currentAuthor,
        currentPage: selectedBook?.currentProgress ?? leavingProfile.currentPage,
        totalPageCount: selectedBook?.totalProgress ?? leavingProfile.totalPageCount,
        progressMode: selectedBook?.progressMode ?? leavingProfile.progressMode,
        favoriteAuthors,
        status: nextStatus,
        backgroundScene: profileForm.backgroundScene || leavingProfile.backgroundScene || 'ocean-beach',
        avatarIcon: leavingProfile.avatarIcon,
        isActive: false,
      }),
    }).catch(() => undefined);
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
      if (!loginResult.joined && loginResult.reason === 'active-limit') {
        const observerProfile = createObserverProfile(trimmed);
        setProfile(observerProfile);
        const { books, currentBookIndex } = normalizeIncomingBooks(observerProfile);
        setProfileForm({
          books: profileToBookDrafts(books),
          editingBookIndex: currentBookIndex,
          favoriteAuthors: observerProfile.favoriteAuthors.join(', '),
          backgroundScene: observerProfile.backgroundScene || 'ocean-beach',
        });
        setStatusText(observerProfile.status || 'Reading');
        setAvatarPosition(toRenderedPosition(observerProfile.positionX, observerProfile.positionY, sceneRef.current?.clientWidth ?? 640, sceneRef.current?.clientHeight ?? 520));
        localStorage.setItem('vwr-login-mode', 'observer');
        setError('The active reader limit has been reached. You are joining as an observer.');
        void registerObserver(trimmed);
        refreshSceneData(trimmed);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarMouseEnter = (username: string) => {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      setHoveredReaderUsername(username);
    }
  };

  const handleAvatarMouseLeave = (username: string) => {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      setHoveredReaderUsername((current) => (current === username ? null : current));
    }
  };

  const handleAvatarClick = (event: React.MouseEvent<HTMLDivElement>, username: string) => {
    event.preventDefault();
    event.stopPropagation();
    setHoveredReaderUsername((current) => (current === username ? null : username));
  };

  const safeEditingBookIndex = clampBookIndex(profileForm.editingBookIndex);
  const editingBook = profileForm.books[safeEditingBookIndex] ?? profileForm.books[0] ?? {
    title: '',
    author: '',
    format: 'physical' as BookFormat,
    currentProgress: '0',
    totalProgress: '0',
  };
  const editingBookMode = progressModeForFormat(editingBook?.format ?? 'physical');
  const currentBookSlotLabels = profileForm.books.map((book, index) => {
    const label = book.title.trim() || `Book ${index + 1}`;
    return `Book ${index + 1}: ${label}`;
  });

  const selectedScene = profileForm.backgroundScene || scenePreview;
  const selectedSceneOption = SCENE_OPTIONS.find((option) => option.value === selectedScene) ?? SCENE_OPTIONS[0];
  const announcementVariant = announcementVariantForScene(selectedSceneOption.value);
  const announcementDateLabel = formatLocalAnnouncementDate();
  const scenePanelBackgroundImage = `${import.meta.env.BASE_URL}${selectedSceneOption.imagePath}`;
  const scenePanelOverlay = selectedSceneOption.overlay;
  const sceneWidth = sceneRef.current?.clientWidth ?? 640;
  const currentTooltipClassName = tooltipPlacementClass(getTooltipPlacement(avatarPosition, sceneWidth));

  const handleSceneClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    const scene = sceneRef.current;
    if (!scene || !profile || profile.isObserver) return;

    const clickedAvatar = (event.target as HTMLElement | null)?.closest('.avatar-wrapper');
    if (clickedAvatar) {
      return;
    }

    if (hoveredReaderUsername) {
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

  return (
    <div className="app-shell">
      <header>
        <h1>Virtual Reading World</h1>
        <p>Choose your spot, update your status, and read.</p>
      </header>

      {!profile ? (
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
      ) : (
        <div className="scene-shell">
          <section className="scene-panel" ref={sceneRef} onClick={handleSceneClick}>
            <img className="scene-image" src={scenePanelBackgroundImage} alt="" />
            <div className="scene-overlay" style={{ background: scenePanelOverlay }} />
            <div className="active-reader-count">
              {(profile?.isObserver ? otherReaders.length : otherReaders.length + 1)} / {activeReaderLimit} active readers
              {observerCount > 0 ? ` • ${observerCount} observer${observerCount === 1 ? '' : 's'}` : ''}
            </div>
            {announcementMessage && (
              <div className={`announcement-overlay announcement-overlay-${announcementVariant}`}>
                <div className="announcement-title">Announcements [{announcementDateLabel}]</div>
                <div className="announcement-message">{announcementMessage}</div>
              </div>
            )}
            {!profile.isObserver && (
              <div
                className="avatar-wrapper current-reader"
                style={{ left: `${avatarPosition.x}px`, top: `${avatarPosition.y}px` }}
                onMouseEnter={() => handleAvatarMouseEnter(profile.username)}
                onMouseLeave={() => handleAvatarMouseLeave(profile.username)}
                onClick={(event) => handleAvatarClick(event, profile.username)}
              >
                <div className="avatar-anchor">
                  <div className="avatar">
                    {hoveredReaderUsername === profile.username && (
                      <div className={`avatar-tooltip ${currentTooltipClassName}`}>
                        <div className="tooltip-row">
                          <span className="tooltip-label">Book</span>
                          <span>{profile.currentBook}</span>
                        </div>
                        <div className="tooltip-row">
                          <span className="tooltip-label">Author</span>
                          <span>{profile.currentAuthor}</span>
                        </div>
                        <div className="tooltip-row">
                          <span className="tooltip-label">{progressLabel(profile.progressMode)}</span>
                          <span>{formatProgressDisplay(profile.currentPage ?? 0, profile.totalPageCount ?? 0, profile.progressMode)}</span>
                        </div>
                      </div>
                    )}
                    <span role="img" aria-label="reader">
                      {profile.avatarIcon || (profile.isObserver ? '👀' : '📚')}
                    </span>
                    <span className="book-format-badge" role="img" aria-label="format">
                      {formatBadgeEmoji(profile.books?.[profile.currentBookIndex]?.format ?? 'physical')}
                    </span>
                  </div>
                  <div className="avatar-name">{formatReaderBadgeLabel(profile.username, profile.status)}</div>
                </div>
              </div>
            )}
            {otherReaders.map((reader) => {
              const renderedPosition = toRenderedPosition(reader.positionX, reader.positionY, sceneRef.current?.clientWidth ?? 640, sceneRef.current?.clientHeight ?? 520);
              const tooltipClassName = tooltipPlacementClass(getTooltipPlacement(renderedPosition, sceneWidth));
              return (
                <div
                  key={reader.username}
                  className="avatar-wrapper remote-avatar"
                  style={{ left: `${renderedPosition.x}px`, top: `${renderedPosition.y}px` }}
                  onMouseEnter={() => handleAvatarMouseEnter(reader.username)}
                  onMouseLeave={() => handleAvatarMouseLeave(reader.username)}
                  onClick={(event) => handleAvatarClick(event, reader.username)}
                >
                  <div className="avatar-anchor">
                    <div className={`avatar remote-avatar-badge ${hoveredReaderUsername === reader.username ? 'avatar-hovered' : ''}`}>
                      {hoveredReaderUsername === reader.username && (
                        <div className={`avatar-tooltip ${tooltipClassName}`}>
                          <div className="tooltip-row">
                            <span className="tooltip-label">Book</span>
                            <span>{reader.currentBook}</span>
                          </div>
                          <div className="tooltip-row">
                            <span className="tooltip-label">Author</span>
                            <span>{reader.currentAuthor}</span>
                          </div>
                          <div className="tooltip-row">
                            <span className="tooltip-label">{progressLabel(reader.progressMode)}</span>
                            <span>{formatProgressDisplay(reader.currentPage ?? 0, reader.totalPageCount ?? 0, reader.progressMode)}</span>
                          </div>
                        </div>
                      )}
                      <span role="img" aria-label="reader">
                        {reader.avatarIcon || '📖'}
                      </span>
                      <span className="book-format-badge" role="img" aria-label="format">
                        {formatBadgeEmoji(reader.books?.[reader.currentBookIndex]?.format ?? 'physical')}
                      </span>
                    </div>
                    <div className="avatar-name remote-avatar-name">{formatReaderBadgeLabel(reader.username, reader.status)}</div>
                  </div>
                </div>
              );
            })}
          </section>

          <aside className="profile-card">
            <div className="profile-card-header">
              <h2>{profile.username}</h2>
              {!profile.isObserver && (
                <div className="profile-card-controls">
                  <div className="profile-field avatar-field compact-avatar-field">
                    <label>Avatar</label>
                    <select
                      className="avatar-select"
                      value={avatarIconDraft || AVATAR_OPTIONS[0]}
                      onChange={(event) => {
                        const nextIcon = event.target.value;
                        setAvatarIconDraft(nextIcon);
                      }}
                    >
                      {AVATAR_OPTIONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            {profile.isObserver ? (
              <div className="profile-field">
                <label>Observer mode</label>
                <p>You are viewing the beach without a stored profile.</p>
              </div>
            ) : (
              <form onSubmit={saveProfile}>
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
                        {option.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="profile-field">
                  <label htmlFor="statusText">Reading status or mood</label>
                  <input
                    id="statusText"
                    className="status-text-input"
                    value={statusText}
                    onChange={(event) => setStatusText(event.target.value)}
                    placeholder="in a coffee break"
                    maxLength={48}
                  />
                  <p className="progress-hint">A short witty one-liner is ideal.</p>
                </div>
                <div className="profile-field profile-field-divider">
                  <div className="simple-divider" aria-hidden="true" />
                  <label>Editing current book</label>
                  <div className="book-slot-tabs" role="tablist" aria-label="Book slots">
                    {[0, 1, 2].map((index) => (
                      <button
                        key={`book-slot-${index + 1}`}
                        type="button"
                        role="tab"
                        aria-selected={safeEditingBookIndex === index}
                        className={`book-slot-tab ${safeEditingBookIndex === index ? 'book-slot-tab-active' : ''}`}
                        onClick={() => {
                          setProfileForm((current) => ({
                            ...current,
                            editingBookIndex: index,
                          }));
                        }}
                      >
                        {`Book ${index + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="progress-hint">The selected editing slot is the current book shown in scene after save.</p>
                <div className="book-editor-box">
                  <div className="book-editor-title">{currentBookSlotLabels[safeEditingBookIndex] || `Book ${safeEditingBookIndex + 1}`}</div>
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
                      </div>
                    </div>
                    <p className="progress-hint">
                      {editingBookMode === 'audio'
                        ? 'Enter minutes or h/m format (e.g. 5h5m / 10h30m).'
                        : 'Enter page counts (e.g. 100 / 400).'}
                    </p>
                  </div>
                </div>
                <button type="submit" disabled={loading}>
                  {loading ? 'Saving…' : 'Save profile'}
                </button>
              </form>
            )}
            {profile.isObserver && (
              <div>
                When space opens up in the active reader list, you can leave and rejoin as an active reader.
              </div>
            )}
            <button type="button" className="secondary" onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void handleLeave();
            }}>
              Leave
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}

export default App;

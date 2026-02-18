const LOCAL_PROGRESS_KEY = 'store-progress';
const STORE_OPEN_PENDING_KEY = 'store-open-pending-at';
const STORE_OPEN_PENDING_WINDOW_MS = 45_000;

export const resolveStoreSetupDestination = (): string => {
  if (typeof window === 'undefined') return '/studio/store/essentials';

  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.essentialsComplete) {
      return '/studio/store/setup';
    }
  } catch {
    // Ignore local storage parsing errors.
  }

  return '/studio/store/essentials';
};

export const markStoreOpenPending = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORE_OPEN_PENDING_KEY, String(Date.now()));
  } catch {
    // Ignore local storage errors.
  }
};

export const clearStoreOpenPending = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORE_OPEN_PENDING_KEY);
  } catch {
    // Ignore local storage errors.
  }
};

export const isStoreOpenPending = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const raw = localStorage.getItem(STORE_OPEN_PENDING_KEY);
    if (!raw) return false;
    const openedAt = Number(raw);
    if (!Number.isFinite(openedAt)) return false;
    return Date.now() - openedAt < STORE_OPEN_PENDING_WINDOW_MS;
  } catch {
    return false;
  }
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });


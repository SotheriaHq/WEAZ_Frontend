const LEGACY_LOCAL_PROGRESS_KEY = 'store-progress';
const LOCAL_PROGRESS_KEY_PREFIX = 'store-progress:';
const LEGACY_STORE_OPEN_PENDING_KEY = 'store-open-pending-at';
const STORE_OPEN_PENDING_KEY_PREFIX = 'store-open-pending-at:';
const STORE_OPEN_PENDING_WINDOW_MS = 45_000;
const ANONYMOUS_SCOPE_KEY = 'anonymous';

type BrandProfileCompletenessSource = {
  type?: string | null;
  brandDescription?: string | null;
  brandTags?: string[] | null;
  brandCountry?: string | null;
  brandState?: string | null;
};

const normalizeUserId = (userId?: string | null): string | null => {
  const candidate = String(userId ?? '').trim();
  return candidate.length > 0 ? candidate : null;
};

const normalizeNextPath = (path?: string | null): string | null => {
  const candidate = String(path ?? '').trim();
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return null;
  }
  return candidate;
};

const resolveScopedKey = (
  prefix: string,
  userId?: string | null,
): string => {
  const normalizedUserId = normalizeUserId(userId);
  return `${prefix}${normalizedUserId ?? ANONYMOUS_SCOPE_KEY}`;
};

export const saveStoreProgressLocally = (
  progress: Record<string, unknown>,
  userId?: string | null,
): void => {
  if (typeof window === 'undefined') return;

  const key = resolveScopedKey(
    LOCAL_PROGRESS_KEY_PREFIX,
    userId,
  );
  try {
    localStorage.setItem(key, JSON.stringify(progress));
    if (normalizeUserId(userId)) {
      localStorage.removeItem(LEGACY_LOCAL_PROGRESS_KEY);
    }
  } catch {
    // Ignore local storage errors.
  }
};

export const readStoreProgressLocally = <
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  userId?: string | null,
): T | null => {
  if (typeof window === 'undefined') return null;

  const key = resolveScopedKey(
    LOCAL_PROGRESS_KEY_PREFIX,
    userId,
  );
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const clearStoreProgressLocally = (userId?: string | null): void => {
  if (typeof window === 'undefined') return;

  const key = resolveScopedKey(
    LOCAL_PROGRESS_KEY_PREFIX,
    userId,
  );
  try {
    localStorage.removeItem(key);
    if (normalizeUserId(userId)) {
      localStorage.removeItem(LEGACY_LOCAL_PROGRESS_KEY);
    }
  } catch {
    // Ignore local storage errors.
  }
};

export const resolveStoreSetupDestination = (userId?: string | null): string => {
  if (typeof window === 'undefined') return '/studio/store/essentials';

  const parsed = readStoreProgressLocally<{
    essentialsComplete?: boolean;
    setupWizardVersion?: number;
  }>(
    userId,
  );
  if (parsed?.essentialsComplete && parsed.setupWizardVersion === 2) {
    return '/studio/store/setup';
  }

  return '/studio/store/essentials';
};

export const isBrandProfileComplete = (
  profile?: BrandProfileCompletenessSource | null,
): boolean => {
  if (!profile || profile.type !== 'BRAND') return true;

  const description = String(profile.brandDescription ?? '').trim();
  const tags = Array.isArray(profile.brandTags)
    ? profile.brandTags.filter((tag) => String(tag ?? '').trim().length > 0)
    : [];
  const hasLocation =
    Boolean(String(profile.brandCountry ?? '').trim()) ||
    Boolean(String(profile.brandState ?? '').trim());

  return description.length >= 20 && tags.length > 0 && hasLocation;
};

export const resolveBrandProfileSetupDestination = (
  nextPath?: string | null,
): string => {
  const params = new URLSearchParams();
  params.set('modal', 'brand-setup');

  const normalizedNextPath = normalizeNextPath(nextPath);
  if (normalizedNextPath) {
    params.set('next', normalizedNextPath);
  }

  return `/profile?${params.toString()}`;
};

export const markStoreOpenPending = (userId?: string | null): void => {
  if (typeof window === 'undefined') return;

  const key = resolveScopedKey(
    STORE_OPEN_PENDING_KEY_PREFIX,
    userId,
  );
  try {
    localStorage.setItem(key, String(Date.now()));
    if (normalizeUserId(userId)) {
      localStorage.removeItem(LEGACY_STORE_OPEN_PENDING_KEY);
    }
  } catch {
    // Ignore local storage errors.
  }
};

export const clearStoreOpenPending = (userId?: string | null): void => {
  if (typeof window === 'undefined') return;

  const key = resolveScopedKey(
    STORE_OPEN_PENDING_KEY_PREFIX,
    userId,
  );
  try {
    localStorage.removeItem(key);
    if (normalizeUserId(userId)) {
      localStorage.removeItem(LEGACY_STORE_OPEN_PENDING_KEY);
    }
  } catch {
    // Ignore local storage errors.
  }
};

export const isStoreOpenPending = (userId?: string | null): boolean => {
  if (typeof window === 'undefined') return false;

  const key = resolveScopedKey(
    STORE_OPEN_PENDING_KEY_PREFIX,
    userId,
  );

  try {
    const raw = localStorage.getItem(key);
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


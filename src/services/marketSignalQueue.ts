import { marketApi, type MarketSignalEvent } from '@/api/MarketApi';

export const WEB_MARKET_SIGNAL_ANONYMOUS_SESSION_STORAGE_KEY =
  'threadly.market.anonymousSessionId.v1';
export const WEB_MARKET_SIGNAL_QUEUE_STORAGE_KEY =
  'threadly.market.signalQueue.v1';
export const WEB_MARKET_SIGNAL_RECENT_STORAGE_KEY =
  'threadly.market.signalRecent.v1';
export const WEB_MARKET_SIGNAL_QUEUE_LIMIT = 100;
export const WEB_MARKET_SIGNAL_BATCH_LIMIT = 25;
export const WEB_MARKET_SIGNAL_FLUSH_INTERVAL_MS = 5000;
export const WEB_MARKET_SIGNAL_DUPLICATE_WINDOW_MS = 30_000;
export const WEB_MARKET_SIGNAL_EVENT_TTL_MS = 24 * 60 * 60 * 1000;
export const WEB_MARKET_SIGNAL_MAX_RETRIES = 5;
export const WEB_MARKET_SIGNAL_RETRY_BASE_MS = 2_000;
export const WEB_MARKET_SIGNAL_RETRY_MAX_MS = 60_000;

type QueuedMarketSignal = {
  event: MarketSignalEvent & { clientEventId: string };
  queuedAt: number;
  retryCount: number;
  nextAttemptAt: number;
};

let queue: QueuedMarketSignal[] = [];
let recentSignalKeys = new Map<string, number>();
let hydrated = false;
let flushing = false;

export const createWebMarketSignalClientId = (prefix: string) => {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
};

const canUseStorage = () => {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
};

const safeReadStorage = (key: string) => {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeWriteStorage = (key: string, value: string) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Signal persistence is best-effort and must not block browsing.
  }
};

const safeRemoveStorage = (key: string) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Signal cleanup is best-effort.
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asQueuedSignal = (value: unknown): QueuedMarketSignal | null => {
  if (!isRecord(value) || !isRecord(value.event)) return null;
  const event = value.event as Record<string, unknown>;
  if (
    typeof event.clientEventId !== 'string' ||
    typeof event.targetType !== 'string' ||
    typeof event.targetId !== 'string' ||
    typeof event.signalType !== 'string' ||
    typeof event.surface !== 'string'
  ) {
    return null;
  }
  return {
    event: event as unknown as QueuedMarketSignal['event'],
    queuedAt: typeof value.queuedAt === 'number' ? value.queuedAt : Date.now(),
    retryCount: typeof value.retryCount === 'number' ? value.retryCount : 0,
    nextAttemptAt: typeof value.nextAttemptAt === 'number' ? value.nextAttemptAt : 0,
  };
};

const hydrateQueue = () => {
  if (hydrated) return;
  hydrated = true;

  const rawQueue = safeReadStorage(WEB_MARKET_SIGNAL_QUEUE_STORAGE_KEY);
  if (rawQueue) {
    try {
      const parsed = JSON.parse(rawQueue);
      queue = Array.isArray(parsed)
        ? parsed.map(asQueuedSignal).filter((entry): entry is QueuedMarketSignal => Boolean(entry))
        : [];
    } catch {
      queue = [];
    }
  }

  const rawRecent = safeReadStorage(WEB_MARKET_SIGNAL_RECENT_STORAGE_KEY);
  if (rawRecent) {
    try {
      const parsed = JSON.parse(rawRecent);
      recentSignalKeys = new Map(
        Array.isArray(parsed)
          ? parsed.filter(
              (entry): entry is [string, number] =>
                Array.isArray(entry) &&
                typeof entry[0] === 'string' &&
                typeof entry[1] === 'number',
            )
          : [],
      );
    } catch {
      recentSignalKeys = new Map();
    }
  }
  compactQueue();
  persistQueue();
};

const persistQueue = () => {
  safeWriteStorage(WEB_MARKET_SIGNAL_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  safeWriteStorage(
    WEB_MARKET_SIGNAL_RECENT_STORAGE_KEY,
    JSON.stringify(Array.from(recentSignalKeys.entries())),
  );
};

const compactQueue = () => {
  const now = Date.now();
  queue = queue
    .filter(
      (entry) =>
        now - entry.queuedAt <= WEB_MARKET_SIGNAL_EVENT_TTL_MS &&
        entry.retryCount <= WEB_MARKET_SIGNAL_MAX_RETRIES,
    )
    .slice(-WEB_MARKET_SIGNAL_QUEUE_LIMIT);

  for (const [key, seenAt] of recentSignalKeys.entries()) {
    if (now - seenAt > WEB_MARKET_SIGNAL_DUPLICATE_WINDOW_MS) {
      recentSignalKeys.delete(key);
    }
  }
};

export const getWebMarketSignalAnonymousSessionId = () => {
  const existing = safeReadStorage(WEB_MARKET_SIGNAL_ANONYMOUS_SESSION_STORAGE_KEY);
  if (existing) return existing;

  const created = createWebMarketSignalClientId('anon');
  safeWriteStorage(WEB_MARKET_SIGNAL_ANONYMOUS_SESSION_STORAGE_KEY, created);
  return created;
};

const isNoisySignal = (event: MarketSignalEvent) =>
  event.signalType === 'IMPRESSION' ||
  event.signalType === 'VIEW' ||
  event.signalType === 'MARKET_SECTION_VIEW' ||
  event.signalType === 'SUGGESTION_ITEM_VIEW';

const buildNoisySignalKey = (event: MarketSignalEvent) =>
  [
    event.signalType,
    event.targetType,
    event.targetId,
    event.sectionKey ?? '',
    event.position ?? '',
  ].join(':');

export const enqueueWebMarketSignal = (
  event: MarketSignalEvent,
  options: { screenContext: string; sessionId: string },
) => {
  hydrateQueue();
  const targetId = String(event.targetId ?? '').trim();
  if (!targetId || !event.targetType || !event.signalType || !event.surface) {
    return false;
  }

  const normalized: QueuedMarketSignal['event'] = {
    ...event,
    clientEventId:
      event.clientEventId ?? createWebMarketSignalClientId('market_signal_event'),
    targetId,
    screenContext: event.screenContext ?? options.screenContext,
    sessionId: event.sessionId ?? options.sessionId,
  };

  if (isNoisySignal(normalized)) {
    const key = buildNoisySignalKey(normalized);
    const now = Date.now();
    const lastSeenAt = recentSignalKeys.get(key);
    if (lastSeenAt && now - lastSeenAt < WEB_MARKET_SIGNAL_DUPLICATE_WINDOW_MS) {
      return false;
    }
    recentSignalKeys.set(key, now);
  }

  queue.push({
    event: normalized,
    queuedAt: Date.now(),
    retryCount: 0,
    nextAttemptAt: 0,
  });
  compactQueue();
  persistQueue();
  return true;
};

const getRetryDelay = (retryCount: number) =>
  Math.min(
    WEB_MARKET_SIGNAL_RETRY_BASE_MS * 2 ** Math.max(0, retryCount - 1),
    WEB_MARKET_SIGNAL_RETRY_MAX_MS,
  );

export const flushWebMarketSignals = async (options?: {
  anonymousSessionId?: string;
  sessionId?: string;
}) => {
  hydrateQueue();
  if (flushing || queue.length === 0) return;

  compactQueue();
  const now = Date.now();
  const due = queue
    .filter((entry) => entry.nextAttemptAt <= now)
    .slice(0, WEB_MARKET_SIGNAL_BATCH_LIMIT);
  if (due.length === 0) {
    persistQueue();
    return;
  }

  flushing = true;
  const dueIds = new Set(due.map((entry) => entry.event.clientEventId));
  queue = queue.filter((entry) => !dueIds.has(entry.event.clientEventId));
  persistQueue();

  try {
    await marketApi.sendMarketSignalBatch({
      batchId: createWebMarketSignalClientId('market_signal_batch'),
      anonymousSessionId:
        options?.anonymousSessionId ?? getWebMarketSignalAnonymousSessionId(),
      sessionId: options?.sessionId ?? due[0]?.event.sessionId ?? undefined,
      events: due.map((entry) => entry.event),
    });
  } catch {
    const retryAt = Date.now();
    const retryEntries = due
      .map((entry) => ({
        ...entry,
        retryCount: entry.retryCount + 1,
        nextAttemptAt: retryAt + getRetryDelay(entry.retryCount + 1),
      }))
      .filter((entry) => entry.retryCount <= WEB_MARKET_SIGNAL_MAX_RETRIES);
    queue = [...retryEntries, ...queue].slice(-WEB_MARKET_SIGNAL_QUEUE_LIMIT);
    persistQueue();
  } finally {
    flushing = false;
  }
};

export const clearWebMarketSignalQueue = () => {
  queue = [];
  recentSignalKeys = new Map();
  hydrated = true;
  safeRemoveStorage(WEB_MARKET_SIGNAL_QUEUE_STORAGE_KEY);
  safeRemoveStorage(WEB_MARKET_SIGNAL_RECENT_STORAGE_KEY);
  safeRemoveStorage(WEB_MARKET_SIGNAL_ANONYMOUS_SESSION_STORAGE_KEY);
};

export const __webMarketSignalQueueTestUtils = {
  reset: () => {
    queue = [];
    recentSignalKeys = new Map();
    hydrated = false;
    flushing = false;
    safeRemoveStorage(WEB_MARKET_SIGNAL_QUEUE_STORAGE_KEY);
    safeRemoveStorage(WEB_MARKET_SIGNAL_RECENT_STORAGE_KEY);
    safeRemoveStorage(WEB_MARKET_SIGNAL_ANONYMOUS_SESSION_STORAGE_KEY);
  },
  getQueueSnapshot: () => {
    hydrateQueue();
    return queue.map((entry) => ({ ...entry, event: { ...entry.event } }));
  },
  getRecentSnapshot: () => {
    hydrateQueue();
    return Array.from(recentSignalKeys.entries());
  },
};

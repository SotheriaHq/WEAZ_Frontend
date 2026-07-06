type DiagnosticLevel = 'info' | 'warn' | 'error';

export type ClientDiagnosticEntry = {
  id: string;
  timestamp: string;
  level: DiagnosticLevel;
  scope: string;
  message: string;
  data?: Record<string, unknown>;
};

type DiagnosticControls = {
  enabled: boolean;
  enable: () => void;
  disable: () => void;
  clear: () => void;
  entries: () => ClientDiagnosticEntry[];
  copyText: () => string;
};

declare global {
  interface Window {
    __THREADLY_DIAGNOSTICS__?: DiagnosticControls;
  }
}

const STORAGE_KEY = 'threadly:diagnostics:v1';
const ENABLED_KEY = 'threadly:diagnostics:enabled';
const MAX_ENTRIES = 300;

const nowIso = () => new Date().toISOString();

const hasBrowserStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const parseEntries = (): ClientDiagnosticEntry[] => {
  if (!hasBrowserStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : [];
  } catch {
    return [];
  }
};

const writeEntries = (entries: ClientDiagnosticEntry[]) => {
  if (!hasBrowserStorage()) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.slice(-MAX_ENTRIES)),
    );
  } catch {
    // Ignore storage quota/private-mode failures.
  }
};

const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return `[data-url:${value.length}]`;
    if (value.startsWith('blob:')) return '[blob-url]';
    if (value.length > 500) return `${value.slice(0, 500)}...`;
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (/token|authorization|password|secret|credential|policy|signature/i.test(key)) {
        result[key] = '[redacted]';
        continue;
      }
      result[key] = sanitizeValue(entry);
    }
    return result;
  }
  return undefined;
};

const sanitizeData = (data?: Record<string, unknown>) => {
  if (!data) return undefined;
  return sanitizeValue(data) as Record<string, unknown>;
};

export const areClientDiagnosticsEnabled = () => {
  if (!hasBrowserStorage()) return false;
  return window.localStorage.getItem(ENABLED_KEY) === 'true';
};

export const enableClientDiagnostics = () => {
  if (!hasBrowserStorage()) return;
  window.localStorage.setItem(ENABLED_KEY, 'true');
};

export const disableClientDiagnostics = () => {
  if (!hasBrowserStorage()) return;
  window.localStorage.removeItem(ENABLED_KEY);
};

export const clearClientDiagnostics = () => {
  writeEntries([]);
};

export const getClientDiagnostics = () => parseEntries();

export const formatClientDiagnostics = () => {
  const payload = {
    capturedAt: nowIso(),
    href: typeof window !== 'undefined' ? window.location.href : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    platform: typeof navigator !== 'undefined' ? navigator.platform : null,
    entries: getClientDiagnostics(),
  };
  return JSON.stringify(payload, null, 2);
};

export const addClientDiagnostic = (
  level: DiagnosticLevel,
  scope: string,
  message: string,
  data?: Record<string, unknown>,
) => {
  if (!areClientDiagnosticsEnabled()) return;
  const entry: ClientDiagnosticEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: nowIso(),
    level,
    scope,
    message,
    data: sanitizeData(data),
  };
  writeEntries([...parseEntries(), entry]);
};

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error ?? '') };
};

let initialized = false;

export const initClientDiagnostics = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const params = new URLSearchParams(window.location.search);
  if (
    params.get('debug') === '1' ||
    params.get('threadlyDebug') === '1' ||
    params.get('wiezDebug') === '1'
  ) {
    enableClientDiagnostics();
  }

  const controls: DiagnosticControls = {
    enabled: areClientDiagnosticsEnabled(),
    enable: () => {
      enableClientDiagnostics();
      controls.enabled = true;
      addClientDiagnostic('info', 'diagnostics', 'Diagnostics enabled');
    },
    disable: () => {
      disableClientDiagnostics();
      controls.enabled = false;
    },
    clear: clearClientDiagnostics,
    entries: getClientDiagnostics,
    copyText: formatClientDiagnostics,
  };
  window.__THREADLY_DIAGNOSTICS__ = controls;

  if (!areClientDiagnosticsEnabled()) return;

  addClientDiagnostic('info', 'diagnostics', 'Diagnostics initialized', {
    href: window.location.href,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  });

  window.addEventListener('error', (event) => {
    addClientDiagnostic('error', 'window.error', event.message || 'Window error', {
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      error: normalizeError(event.error),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    addClientDiagnostic('error', 'window.unhandledrejection', 'Unhandled promise rejection', {
      reason: normalizeError(event.reason),
    });
  });
};

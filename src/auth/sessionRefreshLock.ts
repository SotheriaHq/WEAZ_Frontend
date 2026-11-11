let pending: Promise<unknown> = Promise.resolve();

/** All cookie-writing authentication calls share this queue, including logout
 * and sign-in. Web Locks extends it across tabs when the browser supports it. */
export async function withSessionRefreshLock<T>(refresh: () => Promise<T>): Promise<T> {
  const operation = pending.catch(() => undefined).then(() => acrossTabs(refresh));
  pending = operation.catch(() => undefined);
  return operation;
}

async function acrossTabs<T>(refresh: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try { return await navigator.locks.request('wiez:session-refresh', { signal: controller.signal }, refresh); }
    finally { clearTimeout(timer); }
  }
  // The local queue still serializes this tab without Web Locks.
  // No weakening of single-use credentials on browsers without Web Locks.
  // A rotation conflict remains a retryable client error, never proof of logout.
  return refresh();
}

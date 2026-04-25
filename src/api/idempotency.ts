export const createIdempotencyKey = (): string => {
  // Browser-safe UUID generation.
  // Prefer crypto.randomUUID when available.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback: not cryptographically strong, but sufficient for idempotency keys.
  return `idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
};

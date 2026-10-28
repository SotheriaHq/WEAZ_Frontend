import { isAxiosError } from 'axios';

/**
 * Wording that names code, storage or framework internals rather than the
 * person's problem. Shown to nobody: the caller's own sentence replaces it.
 */
const TECHNICAL_MESSAGE =
  /(prisma|\bP\d{4}\b|constraint|violates|foreign key|relation "|column "|exception\b|stack trace|cannot read propert|uuid is expected|should not exist|\bECONN|ENOTFOUND|\bsql\b|query failed)/i;

const isTechnicalMessage = (message: string) => TECHNICAL_MESSAGE.test(message);

/**
 * Transforms technical API errors into clean, human-readable error messages for end users.
 * Never exposes raw internal engineering messages such as "timeout of 15000ms exceeded",
 * "Network Error", "ECONNABORTED", etc.
 */
export function getFriendlyErrorMessage(
  error: unknown,
  fallback: string = 'An unexpected error occurred. Please try again.',
): string {
  if (!error) return fallback;

  if (isAxiosError(error)) {
    // 1. Network / Timeout / Connection abort errors (no response from server)
    if (
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.toLowerCase().includes('timeout')
    ) {
      return 'Connection timed out. Please check your internet connection and try again.';
    }

    if (
      !error.response ||
      error.code === 'ERR_NETWORK' ||
      error.message === 'Network Error'
    ) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }

    // 2. HTTP Status Code specific mappings
    const status = error.response.status;
    if (status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (status >= 500) {
      return 'Something went wrong on our server. Please try again in a few moments.';
    }
    // Sign-in and session failures never say which part was wrong.
    if (status === 401) {
      return 'Invalid credentials';
    }

    // 3. Backend custom error messages from payload
    const data = error.response.data as Record<string, unknown> | undefined;

    // Check structured validation errors from class-validator
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      const first = data.errors[0] as { property?: string; messages?: string[]; constraints?: string[] };
      const prop = (first?.property || '').toLowerCase();
      const firstMsg = first?.messages?.[0] || first?.constraints?.[0];
      if (prop === 'email' || prop.endsWith('.email')) {
        return 'Please enter a valid email address (e.g. name@example.com).';
      }
      if (prop === 'password' || prop.endsWith('.password')) {
        return 'Password must be at least 12 characters.';
      }
      if (typeof firstMsg === 'string' && firstMsg.trim()) {
        return isTechnicalMessage(firstMsg) ? fallback : firstMsg.trim();
      }
    }

    const candidates = [
      data?.message,
      (data?.data as Record<string, unknown> | undefined)?.message,
      data?.error,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        const msg = candidate.trim();
        const lower = msg.toLowerCase();

        if (lower === 'validation failed' || lower === 'bad request') {
          return 'Please check your information and try again.';
        }
        if (msg.includes('ThrottlerException') || lower.includes('too many requests')) {
          return 'Too many requests. Please try again later.';
        }
        if (lower.includes('timeout') || lower.includes('econnaborted')) {
          return 'Connection timed out. Please check your internet connection and try again.';
        }
        // A plain "Refund not found" is the person's answer; it is not a
        // credentials problem, and only a 401 is treated as one (above).
        return isTechnicalMessage(msg) ? fallback : msg;
      }
    }
  }

  // Handle standard JS Error objects or string errors
  const rawMsg =
    typeof (error as { message?: unknown })?.message === 'string'
      ? (error as { message: string }).message.trim()
      : String(error);

  const lowerRaw = rawMsg.toLowerCase();
  if (lowerRaw.includes('timeout') || lowerRaw.includes('econnaborted')) {
    return 'Connection timed out. Please check your internet connection and try again.';
  }
  if (
    lowerRaw.includes('network error') ||
    lowerRaw.includes('failed to fetch') ||
    lowerRaw.includes('err_network')
  ) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }
  if (lowerRaw.includes('throttlerexception') || lowerRaw.includes('too many requests')) {
    return 'Too many requests. Please try again later.';
  }

  // Fall back if message is an ugly technical string or stack artifact
  if (
    rawMsg.startsWith('AxiosError') ||
    rawMsg.startsWith('TypeError') ||
    rawMsg.startsWith('ReferenceError') ||
    rawMsg.includes('ms exceeded') ||
    rawMsg.includes('[object Object]') ||
    isTechnicalMessage(rawMsg)
  ) {
    return fallback;
  }

  return rawMsg || fallback;
}

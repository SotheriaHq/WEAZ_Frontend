/**
 * Numeric input sanitizers — reusable across every form so number fields never
 * accept stray characters (e.g. "8000-AWE" typed into a money field). These run
 * at input time (in the onChange handler) so invalid characters simply never
 * appear, instead of only being caught by a submit-time validation message.
 *
 * They intentionally return a STRING (not a number) so controlled inputs can keep
 * partial values like "" or "12." while the user is still typing. Convert with
 * Number()/parseFloat at submit time as usual.
 */

/**
 * Keep only what belongs in a decimal number: digits and at most one decimal
 * point. Optionally allow a leading minus sign for signed fields. Strips letters,
 * spaces, currency symbols, and duplicate dots.
 */
export const sanitizeDecimalInput = (
  value: string,
  options?: { allowNegative?: boolean; maxDecimals?: number },
): string => {
  const allowNegative = options?.allowNegative ?? false;
  const raw = String(value ?? '');

  const isNegative = allowNegative && /^\s*-/.test(raw);
  // Remove everything except digits and dots.
  let cleaned = raw.replace(/[^0-9.]/g, '');

  // Collapse to a single decimal point (keep the first one).
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    const intPart = cleaned.slice(0, firstDot);
    const fracPart = cleaned.slice(firstDot + 1).replace(/\./g, '');
    const limitedFrac =
      typeof options?.maxDecimals === 'number'
        ? fracPart.slice(0, Math.max(0, options.maxDecimals))
        : fracPart;
    cleaned = `${intPart}.${limitedFrac}`;
  }

  return isNegative ? `-${cleaned}` : cleaned;
};

/**
 * Keep only digits (an unsigned, whole number). Optionally allow a leading minus.
 */
export const sanitizeIntegerInput = (
  value: string,
  options?: { allowNegative?: boolean },
): string => {
  const allowNegative = options?.allowNegative ?? false;
  const raw = String(value ?? '');
  const isNegative = allowNegative && /^\s*-/.test(raw);
  const digits = raw.replace(/[^0-9]/g, '');
  return isNegative && digits.length > 0 ? `-${digits}` : digits;
};

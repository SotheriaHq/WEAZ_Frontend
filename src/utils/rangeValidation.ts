/**
 * One rule, one message, everywhere a form has a min/max pair.
 *
 * Mirrors `threadly-mobile/src/utils/rangeValidation.ts` deliberately — the two
 * clients must reject the same input with the same words, or a brand who is
 * told "maximum price must be at least the minimum" on their phone gets a bare
 * 400 for the identical edit on the web.
 *
 * The server already refuses an inverted range (`assertValidPriceRange` →
 * `PRICE_RANGE_INVALID`, and the 1-7 day delivery guard in
 * `custom-order-configurations.service.ts`). What was missing on both clients
 * was saying so at the field, while the user is still looking at it, instead of
 * at submit — or, on the filter panels, not saying so at all: an inverted
 * filter range matched nothing and rendered an empty grid, which reads as
 * "there is no stock" rather than "you asked for max below min".
 *
 * Both fields carry the error, not just the second one: the pair is wrong, and
 * the user is as likely to fix it by raising the max as by lowering the min.
 */

export type RangeFieldError = {
  /** Message for the minimum field, or null when it is fine. */
  min: string | null;
  /** Message for the maximum field, or null when it is fine. */
  max: string | null;
  /** Single sentence for a summary line or a submit-time toast. */
  summary: string | null;
};

const NO_ERROR: RangeFieldError = { min: null, max: null, summary: null };

function parse(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export type RangeValidationOptions = {
  /**
   * What the pair measures, lower-case: "price", "delivery time", "size".
   * Used to build the message, so it has to read inside a sentence.
   */
  label: string;
  /** Optional unit appended to the summary, e.g. "days". */
  unit?: string;
  /**
   * When true, min === max is rejected too. Defaults to false — a price range
   * of exactly one value is legitimate.
   */
  requireStrictlyGreater?: boolean;
};

/**
 * Validates that `max` is not below `min`.
 *
 * Returns no error while either side is empty or unparsed: a half-typed range
 * is not a wrong range, and shouting at someone mid-keystroke — while they are
 * still typing the second digit of the maximum — trains them to ignore the
 * field. Submit-time gates still catch a pair left incomplete.
 */
export function getRangeError(
  min: string | number | null | undefined,
  max: string | number | null | undefined,
  options: RangeValidationOptions,
): RangeFieldError {
  const minValue = parse(min);
  const maxValue = parse(max);
  if (minValue === null || maxValue === null) return NO_ERROR;

  const { label, unit, requireStrictlyGreater = false } = options;
  const suffix = unit ? ` ${unit}` : '';

  if (requireStrictlyGreater ? maxValue <= minValue : maxValue < minValue) {
    const comparison = requireStrictlyGreater ? 'higher than' : 'at least';
    return {
      min: `Cannot be above the maximum (${maxValue}${suffix}).`,
      max: `Cannot be below the minimum (${minValue}${suffix}).`,
      summary: `Maximum ${label} must be ${comparison} the minimum (${minValue}${suffix}).`,
    };
  }

  return NO_ERROR;
}

/** True when the pair is usable — nothing entered yet counts as usable. */
export function isRangeValid(
  min: string | number | null | undefined,
  max: string | number | null | undefined,
  options: RangeValidationOptions,
): boolean {
  return getRangeError(min, max, options).summary === null;
}

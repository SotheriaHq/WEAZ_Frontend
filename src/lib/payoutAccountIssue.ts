/**
 * Payout failures a brand can fix themselves, and where they go to fix them.
 *
 * A payout request can fail for three reasons that all have the same remedy and
 * all used to end the same way: a red toast, a sentence written for an operator
 * ("Sync the brand payment account"), and nothing to press. The brand had no
 * way to tell whether they had never added an account, or had added one whose
 * bank details never verified, and no route to the screen that resolves either.
 *
 * The screens already exist — the payout account is collected during store
 * setup (`StoreReviewStep`) and editable afterwards at
 * `/settings?tab=billing` (`StorePaymentsSettings`). Only the path from the
 * error to them was missing.
 *
 * Matching is on the server's `code` first. The prose fallback is deliberate
 * and temporary: the web deploys independently of the API, so until the coded
 * errors are live this still recognises the old messages and behaves correctly.
 * Nothing here should ever GAIN a prose matcher — new failures get a code.
 */

export type PayoutAccountIssueCode =
  | 'PAYOUT_ACCOUNT_MISSING'
  | 'PAYOUT_ACCOUNT_INACTIVE'
  | 'PAYOUT_RECIPIENT_INACTIVE';

export type PayoutAccountIssue = {
  code: PayoutAccountIssueCode;
  /** What the brand is told, in their terms. */
  message: string;
  /** The action on the toast. Names the destination, not the problem. */
  ctaLabel: string;
};

/**
 * The payout panel's element id, and the value of `focus` that summons it.
 * Shared so the link and the panel that answers it cannot drift apart.
 */
export const PAYOUT_ACCOUNT_ANCHOR_ID = 'payout-account';

/**
 * Where the brand lands. `focus` is read by the payout panel, which scrolls
 * itself into view and marks itself, so arriving from an error does not drop
 * someone at the top of a settings page to go hunting.
 */
export const PAYOUT_ACCOUNT_SETTINGS_PATH = `/settings?tab=billing&focus=${PAYOUT_ACCOUNT_ANCHOR_ID}`;

const COPY: Record<PayoutAccountIssueCode, { message: string; ctaLabel: string }> = {
  PAYOUT_ACCOUNT_MISSING: {
    message: 'Add the bank account WIEZ should pay you into before requesting a payout.',
    ctaLabel: 'Add payout account',
  },
  PAYOUT_ACCOUNT_INACTIVE: {
    message: 'Your payout account is not active yet. Confirm your bank details to finish setting it up.',
    ctaLabel: 'Open payout settings',
  },
  PAYOUT_RECIPIENT_INACTIVE: {
    message: 'Your bank account still needs to be verified before WIEZ can pay into it.',
    ctaLabel: 'Verify bank account',
  },
};

const readErrorCode = (error: unknown): string =>
  String((error as any)?.response?.data?.code ?? '').trim().toUpperCase();

const readErrorMessage = (error: unknown): string => {
  const raw = (error as any)?.response?.data?.message;
  return typeof raw === 'string' ? raw : '';
};

/**
 * The pre-code wording, recognised so this works before the API redeploys.
 * Ordered most specific first — the recipient message also contains the words
 * "payout account".
 */
const LEGACY_MATCHERS: Array<{ test: RegExp; code: PayoutAccountIssueCode }> = [
  { test: /transfer recipient/i, code: 'PAYOUT_RECIPIENT_INACTIVE' },
  { test: /payout account is not active/i, code: 'PAYOUT_ACCOUNT_INACTIVE' },
];

export const resolvePayoutAccountIssue = (
  error: unknown,
): PayoutAccountIssue | null => {
  const code = readErrorCode(error);
  if (code in COPY) {
    const known = code as PayoutAccountIssueCode;
    return { code: known, ...COPY[known] };
  }

  const message = readErrorMessage(error);
  if (!message) return null;

  for (const matcher of LEGACY_MATCHERS) {
    if (matcher.test.test(message)) {
      return { code: matcher.code, ...COPY[matcher.code] };
    }
  }

  return null;
};

export default resolvePayoutAccountIssue;

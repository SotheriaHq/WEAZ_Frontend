/**
 * What the action bar of a creation/edit form offers, given where the content
 * sits in the review lifecycle.
 *
 * Why this is shared rather than three copies
 * -------------------------------------------
 * Design, product, and collection forms each grew their own footer logic, and
 * each drifted. The failure that prompted this module: a brand answered an
 * admin change request on a design, and the only enabled control read "Update
 * Design" — a label that describes a metadata save, not a resubmission — while
 * "Save Draft" had been swapped out for "Call back from review". So the one
 * action the owner needed (send it back to review) was unlabelled, and the one
 * they pressed appeared to do nothing.
 *
 * The lifecycle is identical for all three entities, so the answer to "which
 * buttons, and what do they say" belongs in one place.
 */

export type ContentReviewStatus =
  | 'DRAFT'
  | 'PROCESSING'
  | 'IN_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'REJECTED'
  | 'FAILED'
  | 'PUBLISHED'
  | 'ARCHIVED'
  | 'REMOVED';

export type ContentEntityKind = 'design' | 'product' | 'collection';

const ENTITY_NOUN: Record<ContentEntityKind, string> = {
  design: 'Design',
  product: 'Product',
  collection: 'Collection',
};

/**
 * Accepts whatever the API actually returned. Statuses arrive from several
 * shapes across the three domains (`publicationStatus`, `status`, sometimes
 * hyphenated or lower-case from query params), so normalise once here instead
 * of at every call site.
 */
export function normalizeContentReviewStatus(
  value: unknown,
): ContentReviewStatus | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!normalized) return null;
  if (normalized === 'INREVIEW' || normalized === 'PENDING_REVIEW') return 'IN_REVIEW';
  if (normalized === 'CHANGESREQUESTED') return 'CHANGES_REQUESTED';
  return normalized as ContentReviewStatus;
}

/**
 * Statuses where the owner's edit is a *resubmission* — the content has already
 * been through review and is waiting on them to send it back.
 */
export function needsResubmission(status: ContentReviewStatus | null): boolean {
  return status === 'CHANGES_REQUESTED' || status === 'REJECTED' || status === 'FAILED';
}

/**
 * The label on the primary (filled) action.
 *
 * The important case is `CHANGES_REQUESTED`: the owner has just done work an
 * admin asked for, and the button has to promise the thing they came to do.
 * "Update Design" reads as "save my text edits" and leaves people believing
 * their content is still stuck.
 */
export function primaryActionLabel(args: {
  status: ContentReviewStatus | null;
  isEditMode: boolean;
  entity: ContentEntityKind;
}): string {
  const { status, isEditMode, entity } = args;
  if (needsResubmission(status)) return 'Resubmit for review';
  if (status === 'IN_REVIEW') return 'Update & resubmit';
  if (!isEditMode) return 'Go live';
  if (status === 'PUBLISHED') return `Update ${ENTITY_NOUN[entity]}`;
  return 'Go live';
}

/** In-flight label for the primary action. Guidelines: loading states end with "…". */
export function primaryActionPendingLabel(status: ContentReviewStatus | null): string {
  if (needsResubmission(status) || status === 'IN_REVIEW') return 'Resubmitting…';
  return 'Going live…';
}

/**
 * Whether "Save Draft" should be offered.
 *
 * Only PUBLISHED content has no draft to fall back to — everything else,
 * including content sitting in review, can be parked. Previously
 * `IN_REVIEW` hid this control entirely and the owner's only exit was to
 * withdraw, which is a heavier, differently-named action.
 */
export function canSaveDraft(status: ContentReviewStatus | null): boolean {
  return status !== 'PUBLISHED';
}

/**
 * "Call back from review" is an *additional* control while a submission is
 * pending — never a replacement for saving a draft.
 */
export function canWithdrawFromReview(status: ContentReviewStatus | null): boolean {
  return status === 'IN_REVIEW';
}

/**
 * A one-line explanation of what pressing the primary action will do, shown
 * next to the action bar. Owners in a change-request cycle otherwise have no
 * confirmation that resubmitting restarts review rather than publishing.
 */
export function reviewStateHint(status: ContentReviewStatus | null): string | null {
  switch (status) {
    case 'CHANGES_REQUESTED':
      return 'Changes were requested. Resubmitting sends this back to the review team.';
    case 'REJECTED':
      return 'This was rejected. Resubmitting sends it back to the review team.';
    case 'FAILED':
      return 'The last publish attempt failed. Resubmitting tries again.';
    case 'IN_REVIEW':
      return 'This is with the review team. You can still edit, save a draft, or call it back.';
    default:
      return null;
  }
}

import { describe, expect, it } from 'vitest';
import {
  canSaveDraft,
  canWithdrawFromReview,
  needsResubmission,
  normalizeContentReviewStatus,
  primaryActionLabel,
  primaryActionPendingLabel,
  reviewStateHint,
} from '../contentReviewActions';

describe('normalizeContentReviewStatus', () => {
  it('accepts the shapes the three domains actually return', () => {
    expect(normalizeContentReviewStatus('CHANGES_REQUESTED')).toBe('CHANGES_REQUESTED');
    expect(normalizeContentReviewStatus('changes-requested')).toBe('CHANGES_REQUESTED');
    expect(normalizeContentReviewStatus('ChangesRequested')).toBe('CHANGES_REQUESTED');
    expect(normalizeContentReviewStatus('in review')).toBe('IN_REVIEW');
    expect(normalizeContentReviewStatus('PENDING_REVIEW')).toBe('IN_REVIEW');
  });

  it('returns null for absent or non-string values rather than guessing', () => {
    expect(normalizeContentReviewStatus(undefined)).toBeNull();
    expect(normalizeContentReviewStatus(null)).toBeNull();
    expect(normalizeContentReviewStatus('   ')).toBeNull();
    expect(normalizeContentReviewStatus(3)).toBeNull();
  });
});

describe('primaryActionLabel', () => {
  /**
   * The reported defect: an owner who had just made the changes an admin asked
   * for saw "Update Design" and believed it only saved text edits. The button
   * has to name the thing they came to do.
   */
  it('promises resubmission after a change request, not a metadata update', () => {
    expect(
      primaryActionLabel({ status: 'CHANGES_REQUESTED', isEditMode: true, entity: 'design' }),
    ).toBe('Resubmit for review');
  });

  it('says the same for rejected and failed content', () => {
    for (const status of ['REJECTED', 'FAILED'] as const) {
      expect(primaryActionLabel({ status, isEditMode: true, entity: 'product' })).toBe(
        'Resubmit for review',
      );
    }
  });

  it('offers go live on a fresh create regardless of entity', () => {
    for (const entity of ['design', 'product', 'collection'] as const) {
      expect(primaryActionLabel({ status: null, isEditMode: false, entity })).toBe('Go live');
    }
  });

  it('only says "Update" for content that is already published', () => {
    expect(
      primaryActionLabel({ status: 'PUBLISHED', isEditMode: true, entity: 'collection' }),
    ).toBe('Update Collection');
    // A DRAFT being edited is not an update — it has never been live.
    expect(primaryActionLabel({ status: 'DRAFT', isEditMode: true, entity: 'design' })).toBe(
      'Go live',
    );
  });
});

describe('action availability', () => {
  /**
   * Save Draft used to be REPLACED by "Call back from review" while a
   * submission was pending, which left owners with no way to park work.
   * They are independent controls.
   */
  it('offers Save Draft in every state except published', () => {
    for (const status of ['DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'REJECTED'] as const) {
      expect(canSaveDraft(status)).toBe(true);
    }
    expect(canSaveDraft('PUBLISHED')).toBe(false);
  });

  it('offers withdraw only while a submission is actually pending', () => {
    expect(canWithdrawFromReview('IN_REVIEW')).toBe(true);
    expect(canWithdrawFromReview('CHANGES_REQUESTED')).toBe(false);
    expect(canWithdrawFromReview('DRAFT')).toBe(false);
  });

  it('offers withdraw and Save Draft together, never one instead of the other', () => {
    expect(canWithdrawFromReview('IN_REVIEW') && canSaveDraft('IN_REVIEW')).toBe(true);
  });
});

describe('needsResubmission', () => {
  it('covers every status where the ball is in the owner’s court', () => {
    expect(needsResubmission('CHANGES_REQUESTED')).toBe(true);
    expect(needsResubmission('REJECTED')).toBe(true);
    expect(needsResubmission('FAILED')).toBe(true);
    expect(needsResubmission('IN_REVIEW')).toBe(false);
    expect(needsResubmission('PUBLISHED')).toBe(false);
    expect(needsResubmission(null)).toBe(false);
  });
});

describe('pending label and hint', () => {
  it('ends loading labels with an ellipsis', () => {
    expect(primaryActionPendingLabel('CHANGES_REQUESTED')).toBe('Resubmitting…');
    expect(primaryActionPendingLabel(null)).toBe('Going live…');
  });

  it('explains what resubmitting will do, and stays quiet when there is nothing to explain', () => {
    expect(reviewStateHint('CHANGES_REQUESTED')).toContain('review team');
    expect(reviewStateHint('IN_REVIEW')).toContain('call it back');
    expect(reviewStateHint('DRAFT')).toBeNull();
    expect(reviewStateHint('PUBLISHED')).toBeNull();
  });
});

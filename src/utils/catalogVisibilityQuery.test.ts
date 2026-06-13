import { describe, expect, it } from 'vitest';
import {
  normalizeCatalogVisibilityQueryValue,
  resolveVisibilityFilterFromQuery,
} from './catalogVisibilityQuery';

describe('catalog visibility query parsing', () => {
  it.each([
    ['visibility=InReview', 'In Review'],
    ['visibility=in-review', 'In Review'],
    ['visibility=in_review', 'In Review'],
    ['contentStatus=in-review', 'In Review'],
    ['contentStatus=changes-requested', 'Changes Requested'],
    ['status=rejected', 'Rejected'],
    ['visibility=Private', 'Private'],
  ])('maps %s to %s', (query, expected) => {
    expect(resolveVisibilityFilterFromQuery(new URLSearchParams(query))).toBe(expected);
  });

  it('normalizes spacing, hyphen, and underscore variants consistently', () => {
    expect(normalizeCatalogVisibilityQueryValue(' In Review ')).toBe('inreview');
    expect(normalizeCatalogVisibilityQueryValue('in-review')).toBe('inreview');
    expect(normalizeCatalogVisibilityQueryValue('in_review')).toBe('inreview');
  });
});

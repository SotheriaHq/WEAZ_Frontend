import { describe, expect, it } from 'vitest';
import {
  PAYOUT_ACCOUNT_ANCHOR_ID,
  PAYOUT_ACCOUNT_SETTINGS_PATH,
  resolvePayoutAccountIssue,
} from '@/lib/payoutAccountIssue';

const apiError = (data: Record<string, unknown>) => ({ response: { data } });

describe('resolvePayoutAccountIssue', () => {
  it('reads the server code in preference to anything else', () => {
    expect(
      resolvePayoutAccountIssue(
        apiError({ code: 'PAYOUT_ACCOUNT_MISSING', message: 'anything at all' }),
      ),
    ).toMatchObject({ code: 'PAYOUT_ACCOUNT_MISSING', ctaLabel: 'Add payout account' });
  });

  it.each([
    ['PAYOUT_ACCOUNT_INACTIVE'],
    ['PAYOUT_RECIPIENT_INACTIVE'],
  ])('recognises %s', (code) => {
    const issue = resolvePayoutAccountIssue(apiError({ code }));
    expect(issue?.code).toBe(code);
    expect(issue?.message).toBeTruthy();
    expect(issue?.ctaLabel).toBeTruthy();
  });

  /*
    The web deploys independently of the API, so the coded errors are not live
    the moment this ships. Until they are, the old prose has to keep working.
  */
  it('still recognises the pre-code wording, so this works before the API redeploys', () => {
    expect(
      resolvePayoutAccountIssue(
        apiError({
          message: 'Brand payout account does not have an active transfer recipient.',
        }),
      )?.code,
    ).toBe('PAYOUT_RECIPIENT_INACTIVE');

    expect(
      resolvePayoutAccountIssue(
        apiError({
          message:
            'Brand payout account is not active. Sync the brand payment account before requesting payout.',
        }),
      )?.code,
    ).toBe('PAYOUT_ACCOUNT_INACTIVE');
  });

  it('prefers the recipient match, whose message also contains "payout account"', () => {
    expect(
      resolvePayoutAccountIssue(
        apiError({
          message: 'Brand payout account does not have an active transfer recipient.',
        }),
      )?.code,
    ).not.toBe('PAYOUT_ACCOUNT_INACTIVE');
  });

  it('returns null for failures the brand cannot fix here, so they are not mislabelled', () => {
    expect(resolvePayoutAccountIssue(apiError({ message: 'Minimum payout amount is 5000' }))).toBeNull();
    expect(resolvePayoutAccountIssue(apiError({ code: 'SOMETHING_ELSE' }))).toBeNull();
    expect(resolvePayoutAccountIssue(new Error('network'))).toBeNull();
    expect(resolvePayoutAccountIssue(null)).toBeNull();
    expect(resolvePayoutAccountIssue(undefined)).toBeNull();
  });

  it('points the brand at the panel that answers the focus param', () => {
    expect(PAYOUT_ACCOUNT_SETTINGS_PATH).toContain('tab=billing');
    expect(PAYOUT_ACCOUNT_SETTINGS_PATH).toContain(`focus=${PAYOUT_ACCOUNT_ANCHOR_ID}`);
  });
});

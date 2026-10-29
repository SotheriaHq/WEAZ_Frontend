import { describe, expect, it } from 'vitest';
import { describeRefund } from './refundPresentation';

describe('refund presentation', () => {
  it.each(['REQUESTED', 'SUBMITTING', 'PROCESSING', 'FAILED', 'NEEDS_ATTENTION'])(
    'does not describe %s as a completed refund', status => {
      const result = describeRefund(status);
      expect(result?.title).not.toBe('Refund processed by the payment provider');
      expect(result?.description).not.toContain('provider confirmed processing');
    },
  );
  it('distinguishes provider completion from bank credit', () => {
    expect(describeRefund('SETTLED')).toMatchObject({ title: 'Refund processed by the payment provider' });
    expect(describeRefund('SETTLED')?.description).toContain('additional time');
  });
  it('does not guess success for missing or future states', () => {
    expect(describeRefund(null)).toBeNull();
    expect(describeRefund('')).toBeNull();
    expect(describeRefund('FUTURE_STATUS')?.title).toBe('Refund status being verified');
  });
});

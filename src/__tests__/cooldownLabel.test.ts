import { describe, it, expect } from 'vitest';
import { formatCooldownLabel } from '../utils/cooldownLabel';

describe('formatCooldownLabel', () => {
  it('returns "later" for undefined', () => {
    expect(formatCooldownLabel(undefined)).toBe('later');
  });
  it('formats same-day time', () => {
    const now = new Date();
    const future = new Date(now.getTime() + 60 * 60 * 1000); // +1h
    expect(formatCooldownLabel(future.toISOString())).not.toBe('later');
  });
  it('formats cross-day date', () => {
    const now = new Date();
    const future = new Date(now.getTime() + 26 * 60 * 60 * 1000); // +26h
    const label = formatCooldownLabel(future.toISOString());
    expect(label).toMatch(/\d/);
  });
  it('handles invalid date', () => {
    expect(formatCooldownLabel('invalid')).toBe('later');
  });
});

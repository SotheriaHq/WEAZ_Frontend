import { describe, expect, it } from 'vitest';
import { daysLeft, lagosDay, planNotice } from './subscriptionPlanNotice';

/*
 * A plan ending must never surprise a brand (owner, Nov 2026: "ensure the
 * user is notified as much as possible … at least be aware on all fronts").
 */
const tiers = [
  { tierKey: 'THREAD', maxActive: 2 },
  { tierKey: 'ASO_OKE', maxActive: 3 },
  { tierKey: 'ARU', maxActive: 4 },
  { tierKey: 'IGWE', maxActive: 6 },
];
const names: Record<string, string> = { THREAD: 'Thread', ASO_OKE: 'Aso-oke', ARU: 'Aru', IGWE: 'Igwe' };
const tierName = (key?: string | null) => names[key ?? ''] ?? key ?? 'paid';
const now = Date.parse('2026-11-10T09:00:00Z');
const inDays = (days: number) => new Date(now + days * 86_400_000).toISOString();
const plan = (overrides: Record<string, unknown> = {}) => ({
  tierKey: 'THREAD',
  status: 'ACTIVE',
  currentPeriodEnd: inDays(20) as string | null,
  cancelAtPeriodEnd: false,
  pendingTierKey: null as string | null,
  recoveryUntil: null as string | null,
  ...overrides,
});
const FREE = 'the free plan: 1 active custom order at a time';

describe('planNotice', () => {
  it('writes days and dates in Lagos time', () => {
    expect(lagosDay('2026-11-30T23:30:00Z')).toBe('1 Dec 2026');
    expect(daysLeft(inDays(0.2), now)).toBe(1);
    expect(daysLeft(inDays(2.5), now)).toBe(3);
  });

  it('stays quiet for a plan that renews, or no plan', () => {
    expect(planNotice(plan(), tiers, tierName, now)).toBeNull();
    expect(planNotice(null, tiers, tierName, now)).toBeNull();
    expect(planNotice(plan({ currentPeriodEnd: null }), tiers, tierName, now)).toBeNull();
  });

  it('warns in the last week of a cancelled plan, without promising a renewal', () => {
    expect(planNotice(plan({ cancelAtPeriodEnd: true }), tiers, tierName, now)?.tone).toBe('info');
    const near = planNotice(plan({ cancelAtPeriodEnd: true, currentPeriodEnd: inDays(3) }), tiers, tierName, now)!;
    expect(near.tone).toBe('warning');
    expect(near.title).toBe('Your Thread plan ends in 3 days');
    expect(near.body).toContain(FREE);
    expect(near.body).toContain(
      'To get 2 active custom orders at a time back, subscribe again when it ends, or move to a bigger plan now.',
    );
    expect(near.body).not.toMatch(/to keep/);
    const top = planNotice(plan({ tierKey: 'IGWE', cancelAtPeriodEnd: true, currentPeriodEnd: inDays(0.3) }), tiers, tierName, now)!;
    expect(top.title).toBe('Your Igwe plan ends within a day');
    expect(top.body).not.toContain('bigger plan');
  });

  it('explains a failed renewal and its recovery date', () => {
    const failed = planNotice(plan({ status: 'PAST_DUE', currentPeriodEnd: inDays(-1), recoveryUntil: inDays(6) }), tiers, tierName, now)!;
    expect(failed.tone).toBe('warning');
    expect(failed.title).toBe('Your Thread renewal didn’t go through');
    expect(failed.body).toContain(FREE);
    expect(failed.body).toContain(`Recover it by ${lagosDay(inDays(6))} (Lagos time) at your current price`);
  });

  it('says when a lapsed plan has moved to the free plan', () => {
    const lapsed = planNotice(plan({ status: 'CANCELLED', cancelAtPeriodEnd: true, currentPeriodEnd: inDays(-0.1) }), tiers, tierName, now)!;
    expect(lapsed.title).toBe('Your brand is now on the free plan');
    expect(lapsed.body).toContain('Subscribe again to get 2 active custom orders at a time back.');
  });

  it('warns before a smaller plan takes over', () => {
    const down = planNotice(plan({ tierKey: 'ARU', pendingTierKey: 'THREAD', currentPeriodEnd: inDays(2) }), tiers, tierName, now)!;
    expect(down.tone).toBe('warning');
    expect(down.title).toBe('Your plan changes to Thread in 2 days');
    expect(down.body).toContain('from Aru to Thread: 2 active custom orders at a time');
    expect(planNotice(plan({ tierKey: 'ARU', pendingTierKey: 'THREAD', currentPeriodEnd: inDays(10) }), tiers, tierName, now)?.tone).toBe('info');
  });
});

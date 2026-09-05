import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_SECTION_ORDER,
  groupNotificationsBySection,
  resolveNotificationSection,
} from './notificationSections';

const NOW = new Date('2026-08-09T12:00:00.000Z').getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe('resolveNotificationSection', () => {
  it('buckets by age, newest first', () => {
    expect(resolveNotificationSection(at(0), NOW)).toBe('highlights');
    expect(resolveNotificationSection(at(23 * HOUR), NOW)).toBe('highlights');
    expect(resolveNotificationSection(at(2 * DAY), NOW)).toBe('last3days');
    expect(resolveNotificationSection(at(5 * DAY), NOW)).toBe('last7days');
    expect(resolveNotificationSection(at(20 * DAY), NOW)).toBe('last30days');
    expect(resolveNotificationSection(at(90 * DAY), NOW)).toBe('older');
  });

  it('treats each boundary as the start of the next bucket', () => {
    // Exactly 24h old is no longer a highlight; a millisecond under still is.
    expect(resolveNotificationSection(at(DAY - 1), NOW)).toBe('highlights');
    expect(resolveNotificationSection(at(DAY), NOW)).toBe('last3days');
    expect(resolveNotificationSection(at(3 * DAY), NOW)).toBe('last7days');
    expect(resolveNotificationSection(at(7 * DAY), NOW)).toBe('last30days');
    expect(resolveNotificationSection(at(30 * DAY), NOW)).toBe('older');
  });

  it('surfaces unusable timestamps at the top rather than burying them', () => {
    expect(resolveNotificationSection('not-a-date', NOW)).toBe('highlights');
    expect(resolveNotificationSection(null, NOW)).toBe('highlights');
    expect(resolveNotificationSection(undefined, NOW)).toBe('highlights');
    // Clock skew: a "future" notification must not fall through to `older`.
    expect(resolveNotificationSection(at(-5 * DAY), NOW)).toBe('highlights');
  });
});

describe('groupNotificationsBySection', () => {
  it('emits only non-empty sections, in fixed order', () => {
    const sections = groupNotificationsBySection(
      [
        { id: 'old', createdAt: at(60 * DAY) },
        { id: 'today', createdAt: at(2 * HOUR) },
        { id: 'week', createdAt: at(5 * DAY) },
      ],
      NOW,
    );

    expect(sections.map((s) => s.key)).toEqual(['highlights', 'last7days', 'older']);
    expect(sections.map((s) => s.label)).toEqual(['Highlights', 'Last 7 days', 'Older']);
  });

  it('preserves input order inside a section', () => {
    const sections = groupNotificationsBySection(
      [
        { id: 'a', createdAt: at(1 * HOUR) },
        { id: 'b', createdAt: at(3 * HOUR) },
        { id: 'c', createdAt: at(2 * HOUR) },
      ],
      NOW,
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('loses nothing — every input lands in exactly one section', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: String(i),
      createdAt: at(i * DAY),
    }));

    const sections = groupNotificationsBySection(items, NOW);
    const flattened = sections.flatMap((s) => s.items.map((i) => i.id));

    expect(flattened).toHaveLength(items.length);
    expect(new Set(flattened).size).toBe(items.length);
  });

  it('returns nothing for an empty list', () => {
    expect(groupNotificationsBySection([], NOW)).toEqual([]);
  });

  it('keeps section order aligned with the exported order constant', () => {
    const sections = groupNotificationsBySection(
      [
        { id: '1', createdAt: at(0) },
        { id: '2', createdAt: at(2 * DAY) },
        { id: '3', createdAt: at(5 * DAY) },
        { id: '4', createdAt: at(20 * DAY) },
        { id: '5', createdAt: at(60 * DAY) },
      ],
      NOW,
    );

    expect(sections.map((s) => s.key)).toEqual([...NOTIFICATION_SECTION_ORDER]);
  });
});

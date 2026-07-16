/**
 * feedMixer — presentation-level scored rotation for product grids.
 *
 * WHY: the Market grid was rendered in plain recency order, so every visit
 * showed the exact same stack. Product rule: content must be MIXED on every
 * login / refresh / re-route while still favouring fresh + engaging items.
 *
 * Scoring (mirrors the backend Runway feed rules):
 *   recency    = exp(-ageDays / 5)                     // half-life ≈ 3.5 days
 *   engagement = log1p(2*threads + 0.2*views) / 8      // log-scaled
 *   score      = 0.6*recency + 0.4*engagement, floor 0.6 for < 48h old items
 *
 * Rotation: Efraimidis–Spirakis weighted sampling — sortKey =
 * u^(1/score) with u = seededUnit(seed, id). Deterministic for a given seed
 * (stable while the screen is mounted), reshuffled on every fresh mount.
 *
 * Diversity: greedy pass avoids two consecutive cards from the same brand.
 */

export interface MixableItem {
  id: string;
  brandId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  viewsCount?: number | null;
  threadsCount?: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_CONTENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const NEW_CONTENT_SCORE_FLOOR = 0.6;
const MIN_SAMPLING_SCORE = 0.05;

/** Deterministic 32-bit FNV-1a hash of seed+id mapped to (0, 1). */
export const seededUnit = (seed: string, itemId: string): number => {
  const input = `${seed}:${itemId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) + 0.5) / 4294967296.5;
};

export const createMixSeed = (): string =>
  `${Date.now().toString(36)}${Math.floor(Math.random() * 0xffffffff).toString(36)}`;

const toMs = (value?: string | null): number => {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
};

const countOf = (value?: number | null): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

export const scoreMixableItem = (item: MixableItem, nowMs: number): number => {
  const freshestMs = Math.max(toMs(item.updatedAt), toMs(item.createdAt));
  const ageDays = freshestMs > 0 ? Math.max(0, (nowMs - freshestMs) / DAY_MS) : 30;
  const recency = Math.exp(-ageDays / 5);
  const engagement = Math.min(
    1,
    Math.log1p(2 * countOf(item.threadsCount) + 0.2 * countOf(item.viewsCount)) / 8,
  );
  let score = 0.6 * recency + 0.4 * engagement;
  if (freshestMs > 0 && nowMs - freshestMs < NEW_CONTENT_WINDOW_MS) {
    score = Math.max(score, NEW_CONTENT_SCORE_FLOOR);
  }
  return score;
};

/**
 * Deterministic (per seed) score-weighted shuffle with a brand-diversity
 * pass. Same (items, seed) always yields the same order — so React renders
 * stay stable while the screen is mounted — and a new seed remixes the grid.
 */
export const mixFeedItems = <T extends MixableItem>(
  items: T[],
  seed: string,
  nowMs: number = Date.now(),
): T[] => {
  if (items.length <= 1) return items;

  const keyed = items.map((item) => ({
    item,
    key:
      seededUnit(seed, item.id) **
      (1 / Math.max(scoreMixableItem(item, nowMs), MIN_SAMPLING_SCORE)),
  }));
  keyed.sort((a, b) => b.key - a.key || (a.item.id < b.item.id ? -1 : 1));

  const ordered = keyed.map((entry) => entry.item);
  for (let i = 1; i < ordered.length; i += 1) {
    const prevBrand = ordered[i - 1].brandId;
    if (!prevBrand || ordered[i].brandId !== prevBrand) continue;
    for (let j = i + 1; j < ordered.length; j += 1) {
      if (ordered[j].brandId !== prevBrand) {
        const swap = ordered[i];
        ordered[i] = ordered[j];
        ordered[j] = swap;
        break;
      }
    }
  }
  return ordered;
};

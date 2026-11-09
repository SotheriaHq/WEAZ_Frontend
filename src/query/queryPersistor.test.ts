import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  primeWiezQueryCacheFromStorage,
  resetWiezQueryCachePrimeForTests,
  shouldDehydrateWiezQuery,
  WIEZ_QUERY_CACHE_BUSTER,
  WIEZ_QUERY_CACHE_MAX_AGE_MS,
  WIEZ_QUERY_CACHE_STORAGE_KEY,
} from './queryPersistor';

/*
 * Studio inside the app is a WebView whose document starts fresh on every app
 * launch. Two things decide whether that fresh document paints cached content
 * or a skeleton: what is on disk, and whether it is in the cache before the
 * first render. These pin both.
 */

const NOW = Date.UTC(2026, 10, 9, 12, 0, 0);
const DASHBOARD_KEY = ['dashboard', 'home', 'user_1', '30d'];

function persistedSnapshot(overrides: { buster?: string; timestamp?: number } = {}) {
  return {
    buster: overrides.buster ?? WIEZ_QUERY_CACHE_BUSTER,
    timestamp: overrides.timestamp ?? NOW - 60_000,
    clientState: {
      mutations: [],
      queries: [
        {
          queryKey: DASHBOARD_KEY,
          queryHash: JSON.stringify(DASHBOARD_KEY),
          state: {
            data: { overview: { kpis: { totalRevenue: 125_000 } } },
            dataUpdateCount: 1,
            dataUpdatedAt: NOW - 60_000,
            error: null,
            errorUpdateCount: 0,
            errorUpdatedAt: 0,
            fetchFailureCount: 0,
            fetchFailureReason: null,
            fetchMeta: null,
            isInvalidated: false,
            status: 'success',
            fetchStatus: 'idle',
          },
        },
      ],
    },
  };
}

describe('primeWiezQueryCacheFromStorage', () => {
  beforeEach(() => {
    resetWiezQueryCachePrimeForTests();
    window.localStorage.clear();
  });
  afterEach(() => window.localStorage.clear());

  it('puts persisted data in the cache before anything renders', () => {
    window.localStorage.setItem(WIEZ_QUERY_CACHE_STORAGE_KEY, JSON.stringify(persistedSnapshot()));
    const client = new QueryClient();

    expect(primeWiezQueryCacheFromStorage(client, NOW)).toBe(true);
    expect(client.getQueryData(DASHBOARD_KEY)).toEqual({ overview: { kpis: { totalRevenue: 125_000 } } });
  });

  it('runs once per page load', () => {
    window.localStorage.setItem(WIEZ_QUERY_CACHE_STORAGE_KEY, JSON.stringify(persistedSnapshot()));
    expect(primeWiezQueryCacheFromStorage(new QueryClient(), NOW)).toBe(true);
    expect(primeWiezQueryCacheFromStorage(new QueryClient(), NOW)).toBe(false);
  });

  it('refuses a snapshot from another cache version', () => {
    window.localStorage.setItem(
      WIEZ_QUERY_CACHE_STORAGE_KEY,
      JSON.stringify(persistedSnapshot({ buster: 'older-build' })),
    );
    const client = new QueryClient();
    expect(primeWiezQueryCacheFromStorage(client, NOW)).toBe(false);
    expect(client.getQueryData(DASHBOARD_KEY)).toBeUndefined();
  });

  it('refuses a snapshot older than the cache max age', () => {
    window.localStorage.setItem(
      WIEZ_QUERY_CACHE_STORAGE_KEY,
      JSON.stringify(persistedSnapshot({ timestamp: NOW - WIEZ_QUERY_CACHE_MAX_AGE_MS - 1 })),
    );
    const client = new QueryClient();
    expect(primeWiezQueryCacheFromStorage(client, NOW)).toBe(false);
    expect(client.getQueryData(DASHBOARD_KEY)).toBeUndefined();
  });

  it('survives an empty or corrupt store', () => {
    expect(primeWiezQueryCacheFromStorage(new QueryClient(), NOW)).toBe(false);
    resetWiezQueryCachePrimeForTests();
    window.localStorage.setItem(WIEZ_QUERY_CACHE_STORAGE_KEY, '{not json');
    expect(primeWiezQueryCacheFromStorage(new QueryClient(), NOW)).toBe(false);
  });
});

describe('shouldDehydrateWiezQuery', () => {
  it('writes real Studio dashboard data to disk', () => {
    const client = new QueryClient();
    client.setQueryData(DASHBOARD_KEY, { overview: { kpis: {} } });
    const query = client.getQueryCache().find({ queryKey: DASHBOARD_KEY })!;
    expect(shouldDehydrateWiezQuery(query)).toBe(true);
  });

  it('never writes the empty stand-in shown before anything real loaded', () => {
    const client = new QueryClient();
    client.setQueryData(DASHBOARD_KEY, { overview: { kpis: {} }, isFallback: true });
    const query = client.getQueryCache().find({ queryKey: DASHBOARD_KEY })!;
    expect(shouldDehydrateWiezQuery(query)).toBe(false);
  });

  it('never writes Studio orders', () => {
    const client = new QueryClient();
    const key = ['studio', 'orders', 'brand_1', 1, 'all', ''];
    client.setQueryData(key, { items: [] });
    const query = client.getQueryCache().find({ queryKey: key })!;
    expect(shouldDehydrateWiezQuery(query)).toBe(false);
  });
});

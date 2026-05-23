# Final Routing, Data, and Media Hardening

Date: 2026-05-23

This document is the release-readiness reference for the web side of the Threadly routing, data, and media performance hardening work from Phase 0 through Phase 8.

## Original Problem

The original audit found repeated web API calls during profile/catalog/detail navigation, inline collection opening, back navigation, store shell reads, and media URL resolution. Route-local `useEffect` ownership caused repeated `/store/status`, upload limits, cart, bag, wishlist, profile, detail, saved, private-access, threaded-status, comments, and notification settings reads. Several screens showed hard loader/skeleton resets when usable cached data already existed.

## Final Web State

- Catalog/profile/detail/inline collection hot paths use shared TanStack Query ownership.
- Store status, upload limits, cart, wishlist, bag count, auth profile, private-access, saved/threaded checks, comments, notification settings, and active custom-order configuration are cached or coordinated through stable query keys.
- Route and back navigation render cached data without hard skeleton resets when data is available.
- Public media resolution is public-first and avoids resolver endpoint calls when stable payload URLs exist.
- Private signed fallback remains available and was validated against the Phase 5C local/dev fixture.
- The previous maximum-update-depth warning and seeded S3 ORB image failure were fixed.

## Request-Budget Policy

Web release budget:

- Warm authenticated route flow should remain near the Phase 4/5 budget of 2 requests.
- The remaining warm `/notifications/unread-count` calls are targeted notification health refreshes, not profile/detail route churn.
- Media resolver calls should stay 0 where stable payload URLs exist.
- Signed URL 400s must stay 0.
- Cache-busted/no-store calls must stay 0 for normal route reads.
- Hard skeletons should show only when no cached or initial data exists.

## Query And Cache Policy

Default query policy:

- `staleTime`: `3 * 60 * 1000`
- `gcTime`: `30 * 60 * 1000`
- `retry`: `1`
- `refetchOnMount`: `false`
- `refetchOnWindowFocus`: `false`
- `refetchOnReconnect`: `true`

Persistence policy:

- Web uses localStorage through `PersistQueryClientProvider`.
- Persisted cache uses `THREADLY_QUERY_CACHE_V1` and a cache buster.
- Public, non-sensitive server state may persist.
- Auth/session data, cart/wishlist/bag server state, notification/messaging counts, and private signed URLs must not be treated as long-lived persisted state unless explicitly reviewed.
- Query keys must remain deterministic. Do not use `Date.now()` or `Math.random()` in query keys.
- Mutation invalidation must target affected keys instead of clearing all queries.

## Media Policy

Public media priority:

1. Stable public variant/display URL from the API payload.
2. Stable public original/display URL from the API payload.
3. Query-cached public URL endpoint lookup.
4. Private signed URL fallback only when public access is denied or unavailable.
5. Placeholder/fallback image.

Private media rules:

- Public media must not request signed URLs first.
- Denied private public lookup must fall through to signed fallback for authorized users.
- Public-denial and private signed queries use `retry: false` to avoid request spam.
- Signed URL secrets must never be logged.
- Signed URL query results must not be persisted beyond their valid lifetime.
- Media fallback must not loop on failure.

## CI Quality Gate

Workflow: `.github/workflows/phase8-quality-gate.yml`

Local command:

```bash
npm run ci:phase8
```

The web gate runs:

- `npm run build`
- `npm run lint`
- `npm test -- --run src/__tests__/RequireStoreSetup.test.tsx src/__tests__/useBrandProfile.renderIsolation.test.tsx src/__tests__/renderableMedia.test.ts`
- `npm run check:perf-regressions`

The gate protects build/type integration, ESLint guardrails, focused media/query behavior, public-first/private-fallback media resolution, `retry: false` media fallback, signed URL call centralization, deterministic query keys, and force-refresh-only cache bypass.

CI intentionally excludes authenticated Playwright E2E, private-media fixture seeds, local databases, destructive commands, native runtime validation, and secrets.

## Manual Runtime Checklist

Use `http://localhost:5173`, not `127.0.0.1`, so API/cookie host behavior stays consistent.

Before the trace:

```js
window.__THREADLY_NETWORK_TRACE__?.clear()
```

Trace path:

```text
catalog/profile
-> design detail
-> back
-> inline collection viewer
-> back
-> repeat once
```

After the trace:

```js
window.__THREADLY_NETWORK_TRACE__?.printSummary()
```

Capture:

- total requests
- `/notifications/unread-count`
- profile/detail/collection/comment requests
- public media resolver calls
- signed media resolver calls
- signed URL 400s
- cache-busted/no-store calls
- maximum-update-depth warnings
- ORB/image errors
- loader/skeleton flashes

Acceptance:

- warm total remains near 2 unless a mutation or explicit refresh occurs
- media resolver calls remain 0 where stable URLs exist
- signed URL 400s remain 0
- cache-busted/no-store remains 0
- maximum update-depth warnings remain 0
- ORB/image failures remain 0

## Rollback Plan

- CI rollback: revert `.github/workflows/phase8-quality-gate.yml` and the `ci:phase8` script only if the gate itself is broken.
- Scanner rollback: temporarily remove `npm run check:perf-regressions` from `ci:phase8` only for an urgent hotfix, then restore or replace equivalent coverage before release.
- Query rollback: revert web QueryProvider/query-hook changes as a unit and rerun the route trace.
- Media rollback: preserve denied-private-public-lookup to signed fallback and do not remove private media authorization.

Minimum rollback checks:

```bash
npm run ci:phase8
git diff --check
```

## Deferred Work

- Optional realtime-only notification unread strategy if the two targeted warm health refreshes become product-visible waste.
- Optional full authenticated E2E CI once auth fixtures are stable.
- Optional taxonomy cleanup for legacy category fallback cache bypass.
- Native Android/iOS AppState validation remains owned by the mobile manual release gate.

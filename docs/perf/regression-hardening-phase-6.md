# Phase 6 Regression Hardening

Phase 6 adds a low-noise static guard and one media-query retry hardening change for the web runtime paths stabilized in Phases 2-5C.

## Guard Command

```bash
npm run check:perf-regressions
```

The guard checks:

- query defaults keep `refetchOnMount: false`, `refetchOnWindowFocus: false`, shared `staleTime`, and shared `gcTime`
- query keys remain deterministic and do not use `Date.now()` or `Math.random()`
- persisted query cache includes public media URLs but excludes private signed URLs
- provider setup does not broadly invalidate queries
- `useSignedFileUrl` tries `media.publicUrl(fileId)` before `media.signedUrl(fileId)`
- public-denial and private signed media queries use `retry: false`
- `DesignViewModal` keeps public-first media hydration with no retry spam
- `ImageWithFallback` uses stable initial URLs directly and keeps signed URL in-flight dedupe
- design detail normal reads only use `_cb`, `no-store`, or `no-cache` when explicitly forced
- signed URL endpoint calls stay centralized in `src/api/BrandApi.ts`

## Request-Budget Policy

- Warm web validation should remain near the Phase 5C budget: public media resolver calls 0 where stable URLs exist, signed URL 400s 0, cache-busted/no-store calls 0, ORB/image failures 0, and maximum-update-depth warnings 0.
- The remaining `/notifications/unread-count` calls are targeted unread health refreshes, not route/profile/detail churn. A future realtime-only strategy can revisit them.

## Known Exceptions

`src/api/BrandApi.ts` still contains a legacy category fallback path with explicit cache bypass when the normal taxonomy response maps to an empty list. It is outside the measured catalog/detail/media hot path and should be retired in a dedicated taxonomy cleanup, not as part of this hardening phase.

## Rollback

The scanner is isolated to `scripts/check-perf-regressions.cjs`; the runtime change is limited to `retry: false` on media public/signed query calls in `src/hooks/useSignedFileUrl.ts`.

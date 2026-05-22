# Phase 3C Web Runtime Stabilization

Phase 3C stabilized the seeded web profile, design detail, and inline collection route flow after Phase 3B proved that media resolver calls were clean but web still had duplicate profile/access/status checks and render-loop warnings.

## Runtime Scope

Validated route flow:

`/profile/:brandUserId -> /designs/:designId -> /profile/:brandUserId -> /profile/:brandUserId?tab=collections&collectionId=:collectionId -> repeat once`

The authenticated local trace must use `http://localhost:5173`, not `http://127.0.0.1:5173`, because the web API base URL and backend auth cookies are configured for `localhost`. Using `127.0.0.1` causes refresh/profile/cart calls to run unauthenticated and makes the trace invalid.

## Request Reductions

Phase 3B target counts:

- `GET /users/:id/profile/public`: 5x
- `GET /brands/:id/private-access/my-states`: 4x
- `POST /saved/check/batch`: 3x
- `GET /collections/:id/is-threaded`: 2x
- Public media resolver API calls: 0
- Signed media resolver API calls: 0
- Signed URL 400s: 0
- Cache-busted/no-store calls: 0

Phase 3C authenticated trace:

| Request | Cold | Warm |
| --- | ---: | ---: |
| Total traced API requests | 42 | 23 |
| `GET /users/:id/profile/public` | 1 | 0 |
| `GET /brands/:id/private-access/my-states` | 1 | 0 |
| `POST /saved/check/batch` | 1 | 0 |
| `GET /saved/check` | 1 | 0 |
| `GET /collections/:id/is-threaded` | 1 | 0 |
| Public media resolver API calls | 0 | 0 |
| Signed media resolver API calls | 0 | 0 |
| Signed URL 400s | 0 | 0 |
| Cache-busted/no-store calls | 0 | 0 |
| Maximum update depth warnings | 0 | 0 |
| ORB/image request failures | 0 | 0 |

## Root Causes Fixed

- Public profile reads were owned by both `ProfileLayout` and `EndUserProfile`. The visitor classification path now uses `usePublicUserProfileQuery`, and non-owner `EndUserProfile` reads consume the same query key instead of issuing a second direct `apiClient.get`.
- Private access state was route-local in `Catalog.tsx`. It now uses `brandPrivateAccess.myStates(brandId, viewerId)` and patches that query after access-request mutations.
- Saved collection status checks were route-local in collection grids and store collection cards. They now use `saved.batch(targetType, sortedTargetIds)` and patch that query after save/unsave mutations.
- Single saved media checks in `DesignViewModal` now use `saved.status(targetType, targetId)` instead of refetching on each modal open.
- Threaded status checks in `ThreadButton` now use `threaded.collection(collectionId)` or `threaded.collectionMedia(mediaId)` and accept initial threaded data from cards when present.
- The design detail page render loop came from copying detail data into local state inside an effect that also depended on that local state. The effect now avoids equivalent state writes and no longer depends on the local item object.

## ORB Conclusion

The Phase 3B ORB failures were caused by a public media URL endpoint returning a signed S3 object URL for a seeded E2E key even though the file row had a stable public display URL. Chromium requested the signed S3 URL, S3 returned an XML 404 response, and the browser blocked that cross-origin image response.

Backend public media resolution now prefers configured public-base URLs or stable non-S3 `s3Url` display URLs before signing raw S3 keys. Raw S3/private media can still fall back to signing.

## Remaining Web Runtime Gaps

The Phase 3C trace still shows repeated endpoints outside this phase's scope:

- `GET /notifications/settings`
- `GET /designs/:id/:id`
- Collection/comment endpoints under `/api/v1/collections/...`
- Owner-profile side reads such as size-fit and display-chart preferences on authenticated profile paths

These should be handled in a later web runtime phase if the product owner wants to reduce the total warm web count further.

## Known Limits

- Private signed media success remains blocked until a real private media fixture exists.
- Native mobile AppState/background-resume remains unproven by this web-only phase.
- The local trace depends on same-host `localhost` auth. Switching to `127.0.0.1` will produce misleading unauthenticated 401/refresh churn.

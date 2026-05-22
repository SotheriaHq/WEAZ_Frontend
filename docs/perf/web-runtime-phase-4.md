# Phase 4 Web Runtime Stabilization

Phase 4 focused on the remaining web profile/detail/inline collection warm-path repeaters after Phase 3C. The validation flow must use `http://localhost:5173`; `127.0.0.1` does not match the configured API/cookie host and produces invalid auth churn.

## Scope

Measured flow:

`/profile/:brandUserId -> /designs/:designId -> /profile/:brandUserId -> /profile/:brandUserId?tab=collections&collectionId=:collectionId -> repeat once`

The automated Playwright `goBack` harness can hang on this app flow in headless Chromium, so the accepted Phase 4 trace uses React Router history navigation from an authenticated `localhost:5173` session. The route sequence still exercises the same profile, design detail, and inline collection surfaces.

## Query Ownership Added

- Notification settings now use `notifications.settings(userId)` with a 10 minute stale window.
- Comment first pages, unified collection comments, and replies now use stable `comments.*` query keys with a 60 second stale window.
- Comment endpoints that return 404 are cached as empty short-lived misses so missing comment feeds do not refetch and log errors on every route transition.
- Owner profile side reads now use query-backed helpers for `/users/me/profile`, `/users/me/size-fit`, `/users/me/size-fit/shares`, and display-chart preference.
- Active custom-order configuration now uses `customOrders.activeConfiguration(sourceType, sourceId)` with the standard web stale window.

## Runtime Result

Final authenticated SPA trace after code changes:

| Metric | Cold | Warm |
| --- | ---: | ---: |
| Total API requests | 17 | 2 |
| `GET /notifications/settings` | 0 | 0 |
| `GET /designs/:id/custom-order-configuration` | 1 | 0 |
| Comment endpoints | 3 | 0 |
| Comment 404s | 0 | 0 |
| Owner profile side reads | 0 | 0 |
| Public media resolver calls | 0 | 0 |
| Signed media resolver calls | 0 | 0 |
| Signed URL 400s | 0 | 0 |
| Cache-busted/no-store calls | 0 | 0 |
| Maximum update depth warnings | 0 | 0 |
| ORB/image request failures | 0 | 0 |

The only remaining warm requests were two targeted `GET /notifications/unread-count` refreshes. They are intentionally classified as targeted count refreshes, not broad route refetches.

## Remaining Limits

- Native mobile AppState/background-resume is still blocked in this workspace because Android/iOS native tooling is unavailable.
- Private signed-media success still needs a real private-media fixture with a private file id, denied public URL, and authorized user access.
- The Phase 4 web route trace was run with deterministic history navigation because the full back-navigation harness hangs in headless Chromium.

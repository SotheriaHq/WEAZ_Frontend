# Phase 2 Query Cache Baseline

Phase 2 introduces TanStack Query only for the measured web hot paths from Phase 0/1:

- auth profile hydration
- catalog owner/visitor profile and collection lists
- design detail and inline collection detail
- store status
- cart, wishlist, and bag count coordination
- upload limits
- media public/signed URL resolution

Redux remains in place for UI state and existing drawers. Query is used as the shared server-state owner for the repeated reads proven by the tracer.

## Provider

`src/query/QueryProvider.tsx` is wired in `src/main.tsx` inside Redux and around the existing app providers. It uses `PersistQueryClientProvider`, `localStorage`, and React Query Devtools only in development.

## Defaults

- `staleTime`: 3 minutes
- `gcTime`: 30 minutes
- `retry`: 1
- `refetchOnMount`: false
- `refetchOnWindowFocus`: false
- `refetchOnReconnect`: true

Manual refresh and mutation paths use explicit refetch/invalidation.

## Persistence

localStorage key: `THREADLY_QUERY_CACHE_V1`

Buster: `threadly-web-phase2-v1`

Max age: 30 minutes

Persisted keys are limited to non-secret server state:

- brand profile
- brand collection lists/details
- design detail/list data
- upload/config data
- media public URLs

Auth profile, cart, wishlist, bag counts, notifications, messaging, and private signed URLs are not persisted.

## Query Keys

The typed registry lives in `src/query/queryKeys.ts`.

Required hot-path keys:

- `auth.profile`
- `brand.profile(brandId)`
- `brand.collections(ownerId, filters)`
- `brand.collectionDetail(collectionId, scope)`
- `design.detail(designId)`
- `designs.user(userId, params)`
- `store.status`
- `store.cart`
- `store.wishlist`
- `store.bagCount`
- `config.uploadLimits`
- `media.publicUrl(fileId)`
- `media.signedUrl(fileId)`
- `notifications.unreadCount`
- `messaging.unreadCount`

Keys normalize ids and filter objects. They do not include signed URL secrets or non-deterministic values.

## Invalidation Policy

- Updating a profile force-refreshes only `brand.profile(brandId)`.
- Creating/updating/deleting a collection refreshes the owner `brand.collections(ownerId, filters)` and invalidates the affected detail key.
- Updating price/sale metadata patches `brand.collectionDetail(collectionId, scope)` and refreshes the affected list.
- Design detail uses `design.detail(designId)` and falls back to `brand.collectionDetail(designId, design)` only if needed.
- Store setup reads use `store.status`.
- Cart mutations patch `store.cart` and invalidate `store.bagCount`.
- Wishlist mutations invalidate the `store.wishlist` family.
- Upload limits use `config.uploadLimits`; manual refresh removes and refetches only that key.
- Media signed URLs use `media.signedUrl(fileId)` but are not persisted.

## Request Budget

Expected behavior:

- cold empty cache: necessary first requests allowed
- warm navigation inside stale time: cached profile/list/detail renders without blocking refetch
- inline collection viewer: no full skeleton when cached detail exists
- `/store/status`, upload limits, cart, wishlist, and bag count: no route-local repeat inside stale time unless a mutation invalidates them
- signed URL 400 spam: 0
- cache-busted/no-store normal navigation reads: 0

## Known Limits

- Native AppState validation does not apply to web.
- Private media signed URL fallback still needs a real private-media test.
- Broader test harness/theme audit debt remains outside this phase.

Likes & Reactions System

Overview
- Supports likes on two targets: `COLLECTION` (with like/dislike) and `COLLECTION_MEDIA` (per media item likes only).
- Optimistic UI with Redux, realtime reconciliation via Socket.IO, and offline queuing for collection likes.
- Unauthenticated actions are intercepted with a toast and no network call.

Data Model (Prisma)
- Posts
  - `Like` join table prevents duplicates and tracks clientEventId: bthreadly/prisma/schema.prisma:172
  - Denormalized counter on Post: `likesCount Int @default(0)`: bthreadly/prisma/schema.prisma:117
- Collections
  - Reactions table: `CollectionReaction` with `type` enum LIKE|DISLIKE.
  - Denormalized counters on Collection: `likesCount`, `dislikesCount`: bthreadly/prisma/schema.prisma:225
- Collection Media
  - Per‑item likes stored in `CollectionMediaReaction` (LIKE only) and denormalized `likesCount`: bthreadly/prisma/schema.prisma:254

Backend Endpoints (Collections)
- Toggle collection reaction (LIKE or DISLIKE)
  - `POST /collections/:id/reactions/:type` (JWT, throttled)
  - Controller: bthreadly/src/collections/collections.controller.ts:275
  - Service: `toggleReaction(...)` updates counts and daily analytics: bthreadly/src/collections/collections.service.ts:651
- List collection reactions
  - `GET /collections/:id/reactions?limit=20`
  - Controller: bthreadly/src/collections/collections.controller.ts:325
- Likes summary for a collection
  - `GET /collections/:id/likes/summary`
  - Controller: bthreadly/src/collections/collections.controller.ts:493
  - Service aggregates collection + media likes: bthreadly/src/collections/collections.service.ts:1096

Backend Endpoints (Collection Media)
- Toggle like on media item
  - `POST /collections/media/:mediaId/reaction/like` (JWT, throttled)
  - Controller: bthreadly/src/collections/collections.controller.ts:473
  - Service: `toggleMediaLike(...)` increments/decrements `likesCount`: bthreadly/src/collections/collections.service.ts:1052
- Check if current user liked media
  - `GET /collections/media/:mediaId/is-liked` (JWT)
  - Controller: bthreadly/src/collections/collections.controller.ts:491
- List media reactions
  - `GET /collections/media/:mediaId/reactions?limit=20`
  - Controller: bthreadly/src/collections/collections.controller.ts:485

Realtime
- Socket room per target: `${contentType}:${contentId}`. Join via `join` event.
  - Frontend join helper: fthreadly/src/lib/ws.ts:12
- Server emits `like.created` for like-on and `like.removed` for unlike to the room with `{ contentType, contentId, userId, likeCount }`.
  - Gateway: bthreadly/src/realtime/events.gateway.ts:14

Frontend Flow
- Entry: `LikeButton` component handles both `COLLECTION` and `COLLECTION_MEDIA`.
  - Initializes state and joins room: fthreadly/src/components/ui/LikeButton.tsx:31
  - Listens for `like.created`/`like.removed` and applies counts; self events reconcile `likedByMe`: fthreadly/src/components/ui/LikeButton.tsx:46
  - Unauthenticated guard: shows toast and aborts: fthreadly/src/components/ui/LikeButton.tsx:56
  - Optimistic toggle + reconcile on API response; in-flight guard prevents overlapping toggles: fthreadly/src/components/ui/LikeButton.tsx:63
- State management: Redux slice keeps `likedByMe` and `likeCount` by key `${contentType}:${contentId}`.
  - Actions: `setLikeState`, `optimisticToggle`, `reconcile`, `wsApplied`: fthreadly/src/features/engagementSlice.ts:14

HTTP Client
- Reactions API helpers:
  - Media: `toggleCollectionMediaLike`, `getCollectionMediaIsLiked`, `getCollectionMediaReactions`: fthreadly/src/api/ReactionsApi.ts:18
  - Collection: `toggleCollectionLike`, `getCollectionIsLiked`, `getCollectionReactions`: fthreadly/src/api/ReactionsApi.ts:3
  - Collection toggle path: `/collections/:id/reactions/:type` (LIKE/DISLIKE). Media toggle: `/collections/media/:mediaId/reaction/like`.

Unauthenticated UX
- Global toast container styled with purple frosted‑glass gradient and Slide transition: fthreadly/src/App.tsx:66
- LikeButton shows `toast.info('Please sign in to like items.')` and returns early when not authenticated: fthreadly/src/components/ui/LikeButton.tsx:56

Offline Behavior
- When offline, collection toggles are queued (`OfflineLikes`) and flushed on reconnect; media toggles remain optimistic for manual retry.
  - Implementation: fthreadly/src/lib/offlineLikes.ts:1

Testing Notes
- Ensure DB schema contains `CollectionMedia.likesCount`; otherwise media likes will error during reads.
- Verify realtime by opening two windows on the same content; toggling likes in one should update counts in the other.

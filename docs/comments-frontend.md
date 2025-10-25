Comment System v2 (Frontend)

Scope
- Targets: POST, COLLECTION, COLLECTION_MEDIA.
- Depth: max 2 (0 comment, 1 reply, 2 sub-reply). UI prevents deeper nesting.
- Mirroring: In media views, render media comments plus collection comments (badged "From collection"). Counts for collection comments belong to collection scope.

API (consumed)
- Create: POST `/api/v1/{target}/:id/comments` with `{ content, parentId? }`
- List: GET `/api/v1/{target}/:id/comments?cursor=&limit=` (top-level; includes latest 2 replies)
- Replies: GET `/api/v1/comments/:id/replies?cursor=&limit=`
- Toggle like: POST `/api/v1/comments/:id/like` (send `x-client-event-id` for idempotency)
- Is liked: GET `/api/v1/comments/:id/is-liked`
- Delete: DELETE `/api/v1/comments/:id`
- Stats: GET `/api/v1/comments/:id/stats`

State
- Slice: `comments` keyed by `key = `${targetType}:${targetId}` with:
  - `items`: array of top-level comments
  - `cursor`: pagination cursor
  - `replies[commentId]`: array + cursor for replies
  - `likes[commentId]`: { likedByMe, likeCount }
- Optimistic flows:
  - Create: insert local, reconcile on server response; on failure, remove and show toast.
  - Like: optimistic toggle, reconcile on server; rollback on error.
- Realtime integration:
  - Join `${targetType}:${targetId}` and `COMMENT:{commentId}` rooms when visible.
  - Apply `comment.created`, `comment.deleted`, `comment.liked` deltas.

Components
- `CommentComposer` (enforces 500 chars; unauthenticated toast + redirect CTA)
- `CommentList` (virtualized); renders `CommentItem` with:
  - author, content, timestamps, like button, reply button, delete (if permitted)
  - soft-deleted comments as "Comment removed"
- `ReplyList` with lazy load (`View all N replies`)
- `CommentBadge` for mirrored collection comments on media views

UX Notes
- Smooth expand/collapse animations; optimistic insert with gentle highlight.
- Toasts use purple frosted-glass style (global ToastContainer already configured).
- Respect depth limit: reply to depth 2 disabled with tooltip.

Minimal Integration Steps
1) Add `CommentsApi` to call v1 endpoints.
2) Add `commentsSlice` for state and optimistic actions (create, toggleLike, reconcile, wsApplied).
3) Build `CommentThread` widget used in:
   - Post page
   - Collection page
   - Collection media modal/card details (merge media + collection comments).
4) Wire sockets via `joinContentRoom` and add join for `COMMENT:{id}` on visible items.

Testing
- Verify unauthenticated guard and toasts.
- Create → reply → sub-reply (depth 2), depth 3 blocked.
- Two tabs: create/like/delete in one reflects in the other.

Future (Phase 3+)
- Redis-backed caching on list endpoints; optimistic merging with cached pages.
- Moderation/report flows and badges.


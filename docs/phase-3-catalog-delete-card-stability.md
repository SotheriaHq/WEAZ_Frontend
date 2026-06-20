# Phase 3 Catalog Delete and Card Stability

## Delete lifecycle

Draft, Public, Private, and review-status deletes now use the visible optimistic removal as the source of truth. The removed id is filtered locally before the API call. A successful delete does not toggle Draft loading and does not refetch/replace the visible design list. The off-screen Deleted list may refresh independently.

Failure rollback removes the optimistic tombstone. Draft rollback also restores the captured draft DTO because drafts are component-owned. Restoring from Deleted clears the same tombstone before the background content refresh. The existing Deleted-tab local removal behavior is preserved.

## Card render stability

Catalog callbacks are stable rather than recreated for every card. The grid's save handler reads current maps and item lookup through refs, so changing one saved/busy value does not change every card callback. `CatalogEntityCard` passes the original collection DTO instead of cloning it with a spread.

## Thumbnail treatment

Grid media uses a fixed `4:5` frame and `object-cover` for images and video. Dark letterbox backgrounds were removed. The readability gradient is limited to the bottom 40% behind metadata. Detail and immersive viewers were not changed and keep their full-media behavior.

## Edit/retry and status tabs

Post-ID editor routing remains design-id based and compatible with native. Web pre-ID publish tracking remains web-local; the new native snapshot does not claim cross-device recovery. Web status tabs do not render count badges, so no web count-source change was required. Their active state and horizontally scrollable shell remain mounted.

## QR decision

Web catalog QR is opened from explicit header controls and a modal. No row-wide blank-space handler matching the native bug exists, so no web QR code change was made.

## Validation

- `npm exec tsc -- --noEmit`
- `npm test -- --run src/pages/catalog/Catalog.phase3.test.ts`
- `npm run build`
- `git diff --check`

## Manual QA checklist

- Delete Draft, Public, In Review, Changes Requested, and Rejected cards; only the selected card should disappear.
- Force a delete API failure and verify the exact card returns.
- Open Deleted, restore a card, and verify it returns to the appropriate content tab after refresh.
- Confirm no full-grid skeleton appears after delete.
- Compare mixed-aspect image/video cards at desktop, tablet, and mobile web widths.
- Confirm card menus, hover preview, save, edit, retry status, and detail navigation still work.

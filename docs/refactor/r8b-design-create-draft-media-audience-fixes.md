# R8B Design Create Draft, Media, And Audience Fixes

## Executive Summary

R8B stabilizes the Design creation flow around the issues found in manual QA. On web, the Pricing/Sizing cards no longer stretch each other, selected media is released back to the UI immediately after the file picker closes, audience and age group now lead the metadata flow, draft saves route quickly to the Drafts tab, and draft/publish background task metadata can distinguish draft saves from go-live publishes. On mobile, Save Draft and Go Live now follow the same global behavior: after validation the creator is routed back to the Catalog Collections tab with the correct visibility filter while the save or publish continues in a background task card.

No backend schema, migrations, DB reset, seed run, compatibility removal, or design-domain write-mode change was made.

## Root Cause: Side-By-Side Stretch Bug

Pricing & Availability and Sizing & visibility were placed in a responsive two-column grid without cross-axis alignment control. CSS grid stretched both children to the height of the tallest sibling, so expanding custom-order pricing created a tall empty Sizing card.

Fix: the grid now uses `items-start`, both `FormSection` cards use `self-start`, and custom-order configuration is constrained inside the Pricing card with internal scrolling.

## Root Cause: Stale File Selection UI

The file picker set a pending count before opening the file dialog and did not always clear it immediately after dispatching selected files. The media store already created object URL previews, but the picker-level pending state could keep the interaction feeling stale until rendering finished.

Fix: `useFilePicker` now clears pending state on the next tick after handing selected files to the media store, so previews can render immediately and controls become interactive again.

## Root Cause: Slow Save Draft

`executeSaveDraft` waited for the full draft upload/finalization path before completing. That trapped creators on the create screen even though the UI could safely route them to Drafts once a background task was queued.

Fix: web create-mode draft save now queues a draft publish-tracker task, routes to `/profile?tab=Content&visibility=Drafts`, and continues upload/finalization in the background. Mobile now creates a session-scoped design editor task, routes to `/catalog?tab=Collections&visibility=Drafts`, and continues `saveDesignEditor` in the background.

## Root Cause: Post-Draft Modal

The create flow still had legacy `showSaveDraftConfirm` and `showDraftSavedChoices` behavior. The runtime path now bypasses those modals; Save Draft starts the draft task directly and navigates to Drafts.

Known cleanup note: the old modal JSX remains false-gated in `CreateDesign.tsx` because the block contains existing encoded text that resisted safe patch deletion during this pass. It is unreachable at runtime and should be removed in a small cleanup.

## Root Cause: Broken Draft Images

Edit hydration only trusted one media shape (`d.medias`) and missed draft/file response variants such as `media`, `images`, `fileUploadId`, direct preview URLs, and nested file URLs. Draft card mapping also discarded possible media metadata returned by the drafts endpoint.

Fix: draft/design media response normalization now accepts multiple backend shapes, preserves `fileId`/`remoteId`, resolves signed URLs when available, and falls back to direct preview/remote URLs. Draft list mapping now keeps `coverImage`, `coverFileId`, and `previewImages` when any are returned.

## Audience-First Category/Subcategory Audit

Backend accepted values remain:

- Audience/type: `MALE`, `FEMALE`, `EVERYBODY`
- Age group: `ADULT`, `CHILD`

The backend category and category-type payloads do not currently include gender or age applicability metadata. Filter dimensions only expose entity applicability, not audience or age. For R8B, a central frontend V1 helper was added to prevent obvious audience mismatches without scattering checks inside the form.

Deferred: true audience/age-aware taxonomy should be backend-owned with explicit category/category-type applicability metadata.

## Fixes Applied

- Moved web Create Design metadata order to: Who is it for, Age group, What is it, Garment type, Style details, Hashtags.
- Added central audience/category filtering helper for V1 obvious mismatches.
- Cleared invalid category/subcategory selections when audience or age changes.
- Stopped auto-selecting the first category/type on category load.
- Added media normalization for draft/edit hydration.
- Added draft task kind/status support to `publishTracker`.
- Added Drafts-tab placeholders for in-progress draft saves.
- Prevented draft tasks from being polled as live publish tasks.
- Refreshed Drafts after background draft save succeeds.
- Kept go-live background publish behavior separate from draft background save behavior.
- Added mobile `designEditorBackgroundTasks` so Save Draft and Go Live route to Catalog immediately after validation.
- Added mobile Catalog placeholders for draft/public/private design background tasks with local preview, progress copy, and failed-state copy.
- Prevented pending/failed mobile background placeholder cards from navigating to missing design routes.

## Deferred Items

- Backend-owned audience/age applicability metadata for taxonomy.
- Full retry/delete/retry-later controls specifically tailored for failed draft-save placeholders.
- Removal of false-gated legacy draft modal JSX from `CreateDesign.tsx`.
- Manual browser verification of the file picker and route transition in a live browser session.
- Manual device verification for mobile draft/publish task cards and media previews.

## Validation Result

Commands run in `fthreadly`:

- `npm exec tsc -- --noEmit` - passed.
- `npm exec vitest -- run src/api/DesignApi.test.ts src/hooks/useDesignUpload.test.ts src/utils/catalogRoutes.test.ts src/utils/catalogEntity.test.ts src/utils/publishTracker.test.ts src/utils/designAudienceApplicability.test.ts src/utils/designMediaNormalization.test.ts` - passed, 7 files / 22 tests.
- `git diff --check` - passed with line-ending warnings only.

Commands run in `threadly-mobile`:

- `npm exec tsc -- --noEmit` - passed.
- `npm run audit:design-system` - passed.
- `node scripts/test-design-editor-contract.js` - passed.
- `node scripts/test-catalog-entity-contract.js` - passed.
- `git diff --check` - passed with line-ending warnings only.

Manual browser/device checks were not run in this pass. The required manual checklist remains: select media, confirm immediate previews, expand pricing/custom order, save draft, confirm Drafts routing and preview, continue draft, publish, and repeat the draft/publish routing on mobile.

## Remaining Risks

- The V1 frontend audience map is intentionally conservative and should be replaced by backend taxonomy applicability metadata before broader category growth.
- If the drafts endpoint does not return media metadata until background upload completes, the Drafts card will show the local pending preview first and then rely on refresh after save.
- Failed draft background tasks currently reuse the existing publish-failed card affordance copy in one fallback branch.
- Mobile background tasks are session-scoped. They survive the route transition inside the app session but are not persisted across a full app restart.

## Final Decision

R8B is ready for manual QA on web and mobile. The create flow now has the correct runtime behavior for compact audience-first metadata, faster draft routing, safer draft image hydration, independent Pricing/Sizing layout, and global catalog return behavior for draft saves and publishes. Backend was not changed.

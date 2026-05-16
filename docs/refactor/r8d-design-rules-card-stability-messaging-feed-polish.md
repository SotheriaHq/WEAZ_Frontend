# R8D Design Rules, Card Stability, Messaging, and Feed Polish

## Executive summary
Phase R8D tightened Design creation around the domain rule that Designs are not ready-to-wear commerce items. Ready-to-wear remains a Product concern. The web and mobile Design creation UIs now expose only no-size-specification and custom-order sizing choices, while backend enum compatibility remains untouched for legacy records.

The web Designs feed, pending publish cards, profile dropdown, and profile/studio buttons were also audited and adjusted for lower visual churn and better system-theme consistency.

## Design ready-to-wear rule audit
- Web `CreateDesign.tsx` still exposed `RTW` and `RTW_PLUS_FITTINGS`.
- Mobile create-design composer still exposed `RTW_PLUS_FITTINGS`, `RTW`, `CUSTOM`, and `NONE`.
- Backend DTOs and Prisma enum still accept RTW-style values for compatibility. No backend schema or DTO change was made.
- Product creation was not changed and still owns ready-to-wear behavior.

## Publish pending-card audit
Pending profile cards had long status text and secondary explanatory copy. They now use compact status labels such as `Uploading... 45%`, `Finalizing...`, `Live`, and `Failed - Retry`.

## Full-page rerender/refetch audit
- `CreateDesign.tsx` triggered extra collection refetches after background draft/publish work.
- `Catalog.tsx` also refetched on publish state handoff and publish completion.
- `UseBrandHook.ts` showed blocking loading state for every collection refetch.

Fixes keep the current list/pending card visible while reconciliation happens. Refetches no longer force a full skeleton when collections already exist, and profile content loading is suppressed while a live publish task is visible.

## Web direct-message card audit
Web Design cards already had an inline brand-message composer backed by `messagingApi.sendBrandMessage`. R8D added owner/self-message protection and routes unauthenticated users to login with the current page as `next`.

Mobile direct messaging from design cards remains pending and was not implemented in this phase.

## Web/mobile feed filter/chip parity audit
Native mobile uses centered horizontal nav chips in `MarketFeedScreen`. Web Designs feed chips were left-aligned tab text with a distant underline. Web now uses compact centered pill chips closer to the card area.

## Theme/dropdown/button audit
- Profile dropdown hover now uses the same surface-muted token behavior as the rest of the system.
- Selected dropdown items use brand-primary text/background.
- Obvious black CTA buttons in profile catalog nudges and dashboard settings were moved to brand-primary system styling.

## Help/Share Location audit
- Help incorrectly routed to `/help/verified-badge`.
- Share Location immediately called browser geolocation.

Both now show compact coming-soon toasts. The verified-badge page remains available from verified-badge contexts.

## Fixes applied
- Removed RTW sizing options from web Design creation.
- Removed RTW sizing chips from mobile Design creation.
- Normalized legacy Design RTW sizing values to custom-order/no-size-spec UI labels without mutating old records unless saved.
- Kept Design custom-order support.
- Added compact publish status formatter.
- Reduced pending-card status text.
- Avoided broad page loading when publish/draft tasks are active.
- Added silent refetch on web Designs feed window return.
- Added direct-message self-owner guard on web Design cards.
- Updated Designs feed filter chips to closer mobile visual behavior.
- Changed Help and Share Location to coming-soon toasts.
- Updated obvious black buttons to system primary styling.

## Deferred items
- Native mobile direct-message action from design cards.
- Deeper app-wide cache migration for every focus/refetch path.
- Product and StoreCollection background publish normalization beyond the shared pending-card status behavior.
- Backend removal of legacy RTW enum values for Designs, which should wait until compatibility removal is explicitly approved.

## Validation results
- Web `npm exec tsc -- --noEmit`: passed.
- Web `npm exec vitest -- run src/api/DesignApi.test.ts src/hooks/useDesignUpload.test.ts src/api/ProductApi.test.ts src/utils/catalogRoutes.test.ts src/utils/catalogEntity.test.ts src/utils/publishTracker.test.ts src/utils/marketProductMapper.test.ts`: passed, 7 files and 23 tests.
- Web `npm run build`: passed. Vite reported the existing large chunk warning after a successful build.
- Web `git diff --check`: passed with Windows line-ending warnings only.
- Mobile `npm exec tsc -- --noEmit`: passed.
- Mobile `npm run audit:design-system`: passed.
- Mobile `node scripts/test-design-editor-contract.js`: passed.
- Mobile `node scripts/test-catalog-entity-contract.js`: passed.
- Mobile `git diff --check`: passed with Windows line-ending warnings only.
- Backend was not changed, so backend build commands were not run.

## Remaining risks
- Existing legacy Designs with RTW values remain in the database and are normalized only in the creator UI.
- Some non-profile/studio black buttons may remain in older admin/order pages outside the directly observed UI.
- Silent refetch keeps stale feed content visible if the background refresh fails, by design.

## Final decision
R8D is complete for the scoped web/mobile changes. The implementation keeps compatibility intact while aligning new Design creation with the Product/Design domain boundary.

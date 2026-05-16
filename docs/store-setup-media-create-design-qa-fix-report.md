# Store Setup, Media, and Create Design QA Fix Report

Date: 2026-05-16
Repo: `PatrickOloye/Threadly-frotnend`
Branch: `main`

## Summary

This focused QA pass fixes Store Essentials prefill drift, removes the obsolete store Basic Information step from the active setup wizard, carries store processing-time defaults into product/custom-order creation, adds visible payout loading/action states, stabilizes profile/banner media across route changes, and compacts the Create Design metadata panel.

Backend and mobile were not changed. Feed scoring, feed rendering, recommendations, interaction events, market/feed redesign, and taxonomy refactors were untouched.

## Files Changed

- `src/pages/store/StoreEssentials.tsx`
- `src/pages/store/StoreCreationWizard.tsx`
- `src/utils/storeSetup.ts`
- `src/components/store/wizard/StoreBasicInfoStep.tsx` deleted
- `src/components/store/wizard/StorePoliciesStep.tsx`
- `src/components/store/wizard/StoreReviewStep.tsx`
- `src/components/store/StorePaymentAccountPanel.tsx`
- `src/utils/storeProcessing.ts`
- `src/pages/studio/products/EditProduct.tsx`
- `src/pages/catalog/CreateDesign.tsx`
- `src/components/custom-orders/CustomOrderConfigurationEditor.tsx`
- `src/components/ImageWithFallback.tsx`
- `src/components/catalog/ProfileHeader.tsx`
- `src/__tests__/storeSetup.test.ts`
- `src/__tests__/storeProcessing.test.ts`

## Root Causes

1. Store Essentials preselected brand focus values because the screen hydrated from generic brand/profile `tags`, which may contain old profile hashtags or prior incorrect setup data.
2. The obsolete Basic Information wizard step was still mounted as the first `/studio/store/setup` step, causing the brief legacy screen before Socials.
3. Store setup processing time was persisted in store policies, but product/custom-order editors did not consume it as a default.
4. Payout fields were disabled during initialization without a matching loading surface, so users saw inactive controls with no reason.
5. Profile/banner media only kept the last-good URL in component state; route remounts lost that state and showed a blank/shimmer window while signed URLs refreshed.
6. Create Design used a heavier card surface for the right metadata panel and allowed it to grow with full page height instead of scrolling internally.

## Fixes Applied

### Store Essentials Prefill

- Store Essentials no longer hydrates brand specialization from generic brand/profile tags.
- It only restores selected specializations from current-version local Store Essentials progress:
  - `essentialsComplete: true`
  - `setupWizardVersion: 2`
- Stale local setup progress no longer routes users straight into `/studio/store/setup`.
- The max remains 4, and removed options stay removed:
  - Luxury
  - Accessories
  - Footwear
  - Bags
  - Jewelry

### Basic Information Removal

- Removed `StoreBasicInfoStep` from the wizard flow and deleted the unused component file.
- Wizard now starts at Socials, then Policies, then Review.
- Review edits for essentials route back to `/studio/store/essentials`.
- Legacy local step values are not restored into the old flow.

### Processing-Time Defaults

- Added `src/utils/storeProcessing.ts` for shared processing-time labels and lead-day derivation.
- New product creation shows store setup processing time in the shipping section.
- Product and design custom-order configuration editors receive store-derived default production lead days.
- Existing product/custom-order configuration values remain respected and are not overwritten.
- Users can still override lead days per product/design.

### Payout Loading

- Added a visible "Loading payout details..." state while payout account data initializes.
- Added inline loading states for:
  - Save and sync account
  - Resync current account
  - Refresh status
- Pending actions now prevent duplicate submissions without remounting the page.

### Media Cache and Route Stability

- `ImageWithFallback` now keeps a module-level last-good URL cache by stable media identity.
- Profile banner now opts into `keepPreviousOnReload`, matching avatar behavior.
- Route changes can reuse the last rendered image while signed URLs refresh, avoiding visible blank windows.

### Create Design Compactness

- The metadata panel now uses a transparent/system background instead of a separate heavy surface.
- Desktop metadata panel height is capped and scrolls internally.
- Scrollbars are hidden/subtle via the existing `scrollbar-hide` utility.
- The description textarea and metadata spacing were reduced to keep the panel materially shorter.
- Phase 3 taxonomy labels and validation behavior were preserved.

## Commands Run

- `npm exec tsc -- --noEmit` - passed
- `npm run build` - passed
- `npm run lint` - passed with 56 existing warnings, 0 errors
- `npm exec vitest -- run src/__tests__/storeSetup.test.ts src/__tests__/storeProcessing.test.ts src/components/profile/AvatarCard.test.tsx` - passed, 7 tests
- `git diff --check` - passed

## Known Limitations

- Full `CustomOrderConfigurationEditor.test.tsx` still has older expectations around measurement-key auto-seeding. I did not update that unrelated test behavior in this scoped pass.
- Mobile profile/banner upload parity was not changed because this pass did not require shared mobile changes after the frontend cache fix.
- No backend migration was needed because store processing time already exists in store policies.

## Manual QA Checklist

1. Open `/studio/store/essentials` as a new setup user and confirm `0 of 4 selected`.
2. Confirm stale local progress without `setupWizardVersion: 2` does not bypass Store Essentials.
3. Select exactly four brand specializations; a fifth unselected option should be disabled.
4. Continue from Store Essentials and confirm the flow opens Socials directly, not Basic Information.
5. Confirm policies processing time appears as the default for new product custom-order lead days.
6. Open Payments & Payouts and confirm disabled fields have visible loading text while data loads.
7. Use Save/resync/refresh and confirm inline button loaders show.
8. Navigate profile -> setup -> profile and confirm avatar/banner do not blank during normal route transitions.
9. Open `/profile/collections/create` and confirm the metadata panel uses the page background, is shorter, and scrolls internally.

## Confirmation

- Backend was untouched.
- Mobile was untouched.
- Feed scoring/rendering/recommendation/interaction-event work was untouched.
- Taxonomy refactor work was untouched.

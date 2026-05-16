# R8C Form Overlays, Borders, and Custom Order Layout

## Executive summary

R8C focused on creation-form readability and interaction stability. The main fix was moving `UniversalSelect` menus out of local form cards and into a body-level dropdown layer so selects are not clipped by scrollable or bordered panels. The Design creation section boundaries were strengthened, Pricing and Sizing remain independently sized, and Custom Order configuration is now contained inside a shorter internal scroll panel.

No backend schema, seed, migration, feed, recommendation, or compatibility changes were made.

## Border / parent-container audit

Create Design uses a local `FormSection` card for Design Details, Pricing & Availability, and Sizing & Visibility. The parent boundary previously depended on a generic `border` plus `surface-card`, which could visually flatten against the white/page surface during expansion.

The section wrapper now uses an explicit strong border, subtle ring, and expanded-state shadow. The header receives a divider only when open, so the outer parent boundary remains visible without boxing every nested control.

Product create/edit uses larger `surface-card` panels and shared form controls. Collection create/edit uses the same select component and simple bordered form surfaces. Their most likely clipping issue was the shared select menu rather than missing parent borders.

## Dropdown / overlay stacking audit

Root cause: `UniversalSelect` rendered its menu as an absolutely positioned child inside the select wrapper. When that wrapper lived inside scrollable cards, animated panels, or side-by-side grid sections, the menu could render behind sibling cards or be clipped by overflow.

Fix: `UniversalSelect` now renders the dropdown through `createPortal(document.body)`, positions it with fixed viewport coordinates, keeps it on the shared `z-layer-dropdown`, and checks both trigger and menu refs before closing on outside click. The searchable input remains inside the dropdown and keeps its visible border/focus state while typing.

## Design creation findings

- Design Details, Pricing & Availability, and Sizing & Visibility use the local `FormSection`.
- Pricing and Sizing were already in a responsive two-column grid with `items-start`, but the section styling did not make parent boundaries clear enough.
- Custom Order content was shown inline at `52vh`, which still made the Pricing section feel too tall.
- Dead draft confirmation/modal JSX remained in the file after the draft flow was changed.

## Product creation/edit findings

`EditProduct.tsx` uses `UniversalSelect` inside scrollable metadata panels. The portal fix applies to its category, garment type, gender, collection, and metadata selects without product-specific payload changes.

No product-specific layout rewrite was made in this phase.

## Collection creation/edit findings

`CreateCollection.tsx` uses `UniversalSelect` for creator metadata fields. The portal fix applies there as well. Store collection creation did not show the same shared select usage in the audited path, so no store collection-specific edit was made.

## Mobile form overlay findings

Mobile create-design uses `AppBottomSheet`, `AppSelectSheet`, and `AppMultiSelectSheet`. These are native `Modal`-backed sheets with translucent system-bar support, so they are already lifted above cards and footers by platform modal layering.

No mobile files were changed in R8C.

## Custom-order height / layout findings

The Design Pricing card still needs to expose the full custom-order editor, but it should not stretch the full page. The editor is now wrapped in a shorter internal scroll panel (`38vh`, minimum usable height) with a subtle contained surface. The editor root was also tightened to use standard Threadly surface/border tokens.

## Fixes applied

- Portaled `UniversalSelect` dropdown menus to the body-level dropdown layer.
- Added viewport-aware fixed positioning and outside-click handling for portaled menus.
- Preserved searchable dropdown scrolling and search input interaction.
- Strengthened Design form section parent borders and open-state boundary treatment.
- Kept Pricing and Sizing cards aligned independently with existing `items-start` / `self-start` layout.
- Reduced Custom Order inline height and contained it inside an internal scroll panel.
- Removed dead Save Draft / Draft Saved choice modal JSX and unused handlers/state.
- Updated the UniversalSelect test to assert the dropdown uses the body-level layer.

## Deferred items

- Product and StoreCollection form layouts were audited but not redesigned. Any deeper compactness pass should be scoped separately.
- Browser/manual route verification should be repeated in a live browser because jsdom can verify the portal layer but not visual overlap in every viewport.
- Mobile native sheets were audited but not changed; Android/iOS manual QA should confirm no screen-specific sheet overlay issue remains.

## Validation results

- `npm exec tsc -- --noEmit` - passed.
- `npm exec vitest -- run src/api/DesignApi.test.ts src/hooks/useDesignUpload.test.ts src/api/ProductApi.test.ts src/utils/catalogRoutes.test.ts src/utils/catalogEntity.test.ts src/utils/publishTracker.test.ts src/utils/marketProductMapper.test.ts src/components/forms/UniversalSelect.test.tsx` - passed, 8 files / 23 tests.
- `git diff --check` - passed. Git reported CRLF normalization warnings for edited frontend files, but no whitespace errors.

## Remaining risks

- Any non-`UniversalSelect` custom popover that renders inside an overflowed card may still need its own portal treatment.
- Very small browser heights can still constrain dropdown height; the menu remains scrollable but should be checked manually.
- Custom Order remains a dense configuration surface. R8C contains its height, but a future dedicated drawer could improve editing further.

## Final decision

R8C is implemented for the shared web select/dropdown layer, Design form borders, Design Pricing/Sizing height behavior, Custom Order containment, and dead modal cleanup. Backend, seed, schema, feed, taxonomy, and mobile source files were untouched.

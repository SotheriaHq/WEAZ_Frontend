# Phase 3 Web Creator UI Taxonomy Alignment Report

## 1. Summary of Changes

Aligned the web creator metadata UI with the backend taxonomy contract completed in backend Phase 2. The frontend still sends the existing backend DTO fields, but creators now see the softer garment metadata language: "What is it?", "Garment type", "Who is it for?", "Style details", "Cultural vibe", "Where would you wear it?", "Hashtags", and "Who can see this?".

No backend, mobile, feed scoring, feed rendering, recommendation, interaction event, or market/feed UI work was implemented.

## 2. Files Changed

- `src/utils/creatorMetadata.ts`
- `src/components/categories/FilterSelector.tsx`
- `src/components/categories/filterTagSuggestions.ts`
- `src/components/categories/FilterSelector.test.tsx`
- `src/api/ProductApi.ts`
- `src/api/ProductApi.test.ts`
- `src/hooks/useCollectionUpload.ts`
- `src/pages/catalog/CreateDesign.tsx`
- `src/pages/studio/products/EditProduct.tsx`
- `src/pages/studio/store/StoreCollectionCreate.tsx`
- `src/components/modals/PrePublishConfirmModal.tsx`
- `src/components/upload/MediaUploadZone.tsx`
- `docs/phase-3-web-creator-ui-taxonomy-alignment-report.md`

## 3. Screens Audited

- Design create/edit: `src/pages/catalog/CreateDesign.tsx`
- Product create/edit: `src/pages/studio/products/EditProduct.tsx`
- Store collection create/edit: `src/pages/studio/store/StoreCollectionCreate.tsx`
- Shared discovery metadata selector: `src/components/categories/FilterSelector.tsx`
- Tag suggestion source: `src/components/categories/filterTagSuggestions.ts`
- Upload and pre-go-live supporting UI: `src/hooks/useCollectionUpload.ts`, `src/components/modals/PrePublishConfirmModal.tsx`, `src/components/upload/MediaUploadZone.tsx`

## 4. Before/After Label Mapping

| Previous creator label | New creator label |
| --- | --- |
| Category | What is it? |
| Sub-Category / sub-category | Garment type |
| Target Audience / Type / Gender | Who is it for? |
| Filters / Filters & Attributes | Style details, grouped by active dimension |
| Heritage dimension | Cultural vibe |
| Occasion dimension | Where would you wear it? |
| Tags | Hashtags |
| Visibility | Who can see this? |
| Publish / Publish Now | Go live |
| Published | Live |

The normal creator forms no longer expose `categoryTypeId`, `subCategoryId`, `filterValueIds`, `EntityFilter`, `FilterDimension`, `CollectionType`, or `taxonomy` as visible user-facing copy.

## 5. FilterSelector Changes

- Dynamically consumes `brandApi.getFilterDimensions()`, which calls `/categories/filters`.
- Supports active backend dimensions:
  - `style` -> Style details
  - `heritage` -> Cultural vibe
  - `occasion` -> Where would you wear it?
  - `fabric` -> Fabric
  - `color-family` -> Color family
  - `fit` -> Fit
- Excludes legacy dimensions by slug:
  - `fabric-type`
  - `fit-shape`
  - `designer-location`
  - `price-range`
- Unknown active dimensions still render using the backend-provided name.
- Existing `filterSelection` shape is preserved as `{ [dimensionId]: string[] }`.
- Selected values continue to map to `filterValueIds` in page payloads.
- Loading, empty, and failure states are non-blocking for draft save but explain that style details are required before going live.

## 6. Product Audience/Gender Handling

Products now expose "Who is it for?" in the product metadata panel and store the value in `form.gender`.

The API payload mapper now sends backend-compatible `gender` without renaming fields:

- `FEMALE` -> Women
- `MALE` -> Men
- `EVERYBODY` -> Everyone / Unisex

Existing products hydrate `gender` when present. If old product data has no gender, the form falls back to `EVERYBODY` so the active product save can remain compatible with the backend's required audience field.

## 7. Validation Behavior

Draft save remains flexible in design, product, and store collection flows.

Go-live validation now checks creator metadata with friendly messages:

- Missing category: "Choose what this item is."
- Missing subcategory/category type: "Choose a garment type."
- Missing audience: "Choose who this item is for."
- Missing structured filter values: "Add at least one style detail."
- Missing tags: "Add at least one hashtag."

Backend technical errors that mention category IDs, subcategory IDs, filter values, dimensions, entity filters, audience/gender, or tags are mapped into creator-friendly copy where practical.

## 8. Draft Behavior

Draft saves are intentionally not blocked by missing taxonomy, discovery filters, audience, or hashtags beyond each flow's pre-existing draft requirements. Design drafts still use the existing fallback draft tag behavior to preserve backend compatibility.

## 9. API Payload Compatibility Confirmation

Design create/edit still sends:

- `title`
- `description`
- `categoryId`
- `categoryTypeId`
- `subCategoryId`
- `type`
- `visibility`
- `tags`
- `filterValueIds`
- sizing/custom-order fields already expected by the backend

Product create/edit still sends:

- `name` via `title` mapping
- `description`
- `categoryId`
- `categoryTypeId`
- `subCategoryId`
- `gender`
- `tags`
- `filterValueIds`
- existing price, media, variant, inventory, custom-order, and checkout fields

Store collection create/edit still sends:

- `title`
- `description`
- `categoryId`
- `categoryTypeId`
- `subCategoryId`
- `type`
- `visibility`
- `tags`
- `filterValueIds`
- existing product membership fields

No backend DTO field names were renamed.

## 10. UI Compactness Changes

- Reduced metadata panel spacing in impacted screens.
- Replaced heavier metadata boxes with lighter rounded panels and low-opacity borders.
- Kept discovery metadata in compact accordion rows.
- Kept chips compact and displayed tags as hashtags.
- Used existing `InfoTooltip` for audience, style details, cultural vibe, occasion, visibility, and hashtag helper copy.
- Re-enabled thin custom scrollbars where metadata panels scroll.
- Avoided adding new heavy nested bordered boxes.

## 11. Commands Run and Results

- `npm test -- FilterSelector ProductApi --run`
  - Result: Passed. 2 test files, 4 tests.
  - Note: Vitest printed a jsdom `window.scrollTo` not-implemented warning from animation internals after the passing run.
- `npm run lint`
  - Result: Passed with warnings only. Existing app-wide hook/dependency and unused-variable warnings remain.
- `npm run build`
  - Result: Failed on existing TypeScript errors outside the Phase 3 changes:
    - `src/App.tsx(387,7)`: unused `DesignViewAliasRedirect`
    - `src/pages/catalog/DesignDetailsPage.tsx(68,44)`: `VLoader` does not accept a `label` prop
    - `src/utils/notificationRouting.ts(76,17)` and `(88,17)`: impossible comparison against `DESIGN`
- `git diff --check`
  - Result: Passed. Git reported line-ending normalization warnings only.

## 12. Tests Added/Updated

- Added `src/components/categories/FilterSelector.test.tsx`
  - Verifies style, heritage, occasion, fabric, color-family, and fit render.
  - Verifies legacy `price-range` is not rendered.
  - Verifies selection writes back to the existing `filterSelection` structure.
- Updated `src/api/ProductApi.test.ts`
  - Verifies product create payload sends `gender` while preserving `categoryTypeId` and `subCategoryId` aliases.

## 13. Known Limitations

- Existing drafts with old inactive filter value IDs can still hydrate without crashing, but inactive values may not be visible in the active selector. Backend validation will reject inactive values on go-live; the frontend maps those errors into friendly copy where possible.
- Product records with no historical `gender` are defaulted to `EVERYBODY` in the edit form to maintain active-save compatibility with the backend contract.
- Product creation remains inside the existing studio product architecture. This phase did not redesign variants, inventory, media, checkout, or custom-order flows.

## 14. Explicit Exclusions

This phase did not implement or modify:

- Feed scoring
- Feed ranking
- Feed rendering
- Recommendation logic
- Interaction events
- Market/feed UI
- Mobile UI
- Backend code or database fields

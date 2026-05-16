# R8 Creation Form UX, Tags, and Publish Normalization

## 1. Executive Summary

R8 tightened the creator form without changing schema, routes, payload names, seed state, or compatibility aliases.

Implemented:

- Web Create Design now uses compact select controls for audience and age.
- Pricing & Availability and Sizing & visibility now sit side by side on larger screens and stack on small screens.
- Web tag suggestions now fall back from `/tags/trending` to `/tags` when trending fails or is empty after a reset.
- Mobile selected hashtags are visible as chips on the composer and inside the tag sheet.
- Design background publish placeholders can surface even when a preview URL is not available yet.
- Web card thread actions now use the native-aligned thread spool motion instead of the old needle glyph.

Not implemented:

- Audience/age filtering of categories, subcategories, or filters, because backend taxonomy does not expose audience or age applicability metadata.
- Full Product and StoreCollection background publish normalization. Design is the only flow with the current publish task infrastructure.

## 2. Audience/Age-Group Audit

Backend accepted values:

- Audience/type: `MALE`, `FEMALE`, `EVERYBODY`
- Age group: `ADULT`, `CHILD`

Web Create Design sends:

- `type`: `MALE | FEMALE | EVERYBODY`
- `targetAgeGroup`: `ADULT | CHILD`

Mobile Create Design sends:

- `type`: from `audience`
- `targetAgeGroup`: `ADULT | CHILD`

Display labels:

- `MALE` -> Menswear
- `FEMALE` -> Womenswear
- `EVERYBODY` -> Unisex / Everybody
- `ADULT` -> Adult
- `CHILD` -> Kids

Kids is represented only by `targetAgeGroup=CHILD`. Boys, girls, and kids-unisex are not supported enum values and were not introduced.

## 3. Category Dependency Recommendation

Current backend category and category type records do not expose gender/audience or age applicability metadata. Filter dimensions expose `appliesTo` by entity type only, not by wearer/audience or age group.

Recommendation:

- Keep audience and age visible before category details in the UI.
- Defer audience/age-aware option filtering until backend taxonomy supports explicit applicability metadata.
- Do not fake filtering on the frontend, because it would create hidden business rules and compatibility risk.

## 4. Ankara/Fabric/Cultural-Vibe Taxonomy Audit

Ankara can appear in both:

- Heritage/Cultural vibe: heritage, textile tradition, or aesthetic signal.
- Fabric: physical textile/material.

This overlap is valid when labels and helper copy explain the distinction. R8 added clearer Fabric helper copy on web: "Choose the physical textile or material used, such as Ankara fabric."

Tags remain social/search terms and do not replace the structured heritage or fabric values.

## 5. Tag API/Seed Audit

Backend:

- `/tags` returns approved, non-banned popular/seeded tags.
- `/tags/trending` can be empty after a fresh reset because there may be no recent usage.
- Seeded tags are expected to be available through `/tags`.

Web:

- `TagsApi.getSuggestions()` uses trending tags first.
- R8 now falls back to `/tags` if `/tags/trending` fails or returns no parsed tags.

Mobile:

- `TagsApi.getTags()` already reads `/tags` and parses current backend response shapes.
- Mobile continues to allow custom hashtag input if suggestions fail.

## 6. Web Tag UI Result

Selected tags remain visible as chips in web Create Design. The reliability fix is API-level fallback behavior so seeded tags appear after resets even when trending usage is empty or the trending endpoint errors.

## 7. Mobile Tag UI Result

Mobile now shows selected hashtags as chips on the main composer screen, not only as "X selected." The tag sheet also renders a selected chip group so creators can see and remove current selections while browsing unselected suggestions.

## 8. Pricing/Availability Layout Result

Pricing & Availability keeps the existing fields and behavior, but it now participates in a responsive two-column row with Sizing & visibility on desktop/tablet-width screens. Internal helper and option rows were tightened to reduce vertical height.

## 9. Sizing/Visibility Layout Result

Sizing & visibility now sits beside Pricing & Availability on larger screens and stacks on smaller screens. Sizing mode and fit preference are grouped into a compact two-column grid where space allows, and visibility choices are compact two-column options.

## 10. Create-vs-Edit Action Bar Result

Web Create Design now shows Cancel, Save Draft, and Go live as visible actions. New create flow no longer presents "Unsaved changes" as the primary empty-state status. Edit mode may still show "Unsaved changes" when editing an existing record.

## 11. Background Publish Audit

Design create/edit already follows the desired pattern:

1. Validate first.
2. Create a publish task.
3. Route to the profile content tab quickly.
4. Continue upload/finalize in the background.
5. Show pending/failed state through the catalog publish tracker.

R8 improved placeholder surfacing by allowing publish cards without preview URLs and preserving the task title. Product and StoreCollection flows do not yet share the same publish task abstraction and remain deferred for a later normalization pass.

## 12. Card Thread Animation Alignment

Native mobile behavior found:

- `threadly-mobile/components/catalog/ThreadRailAction.tsx` is the current native thread rail control.
- It uses the thread spool glyph, not the old needle glyph.
- On add, it spins and scales the spool over about 680ms, then reveals the count after about 520ms.
- It respects reduced-motion settings.
- It is used on the design feed action rail and collection/detail viewer action rail.
- `ThreadTapBurstOverlay` exists as a richer stitch burst treatment, but the audit found no current call sites.

Web old usage found:

- `src/components/ui/ThreadButton.tsx` still swapped between needle and spool glyphs and animated a needle pass.
- `ThreadButton` is used by web design cards and profile/catalog collection cards, so the old marker leaked into card thread actions.
- `ProfileHeader` also used the old needle for the unpatched brand action; that was not a card, but it was a visible legacy marker and was aligned to the shared thread indicator for consistency.

Fix result:

- Added shared `ThreadActivityIndicator`.
- Updated `ThreadButton` to use one spool-based visual state for idle, add, remove, pending, reduced-motion, and revert states.
- Removed the old needle pass/glyph animation from web card thread controls.
- Kept existing thread count, modal, optimistic engagement, routing, and backend payload behavior unchanged.
- Updated profile patch action to reuse the same decorative thread indicator instead of the legacy needle glyph.

Remaining platform differences:

- Web uses CSS keyframes; native uses Reanimated shared values.
- Web aligns the visible glyph, timing, reduced-motion handling, and count delay closely, but it does not port the unused native stitch-burst overlay.

## 13. Fixes Applied

- Replaced web audience button cards with `UniversalSelect`.
- Kept age group as a compact `UniversalSelect`.
- Put Pricing & Availability and Sizing & visibility into a responsive two-column grid.
- Added inline Save Draft loader.
- Added Cancel to the new Create Design footer.
- Added tag fallback test coverage.
- Added mobile selected hashtag chip previews.
- Added selected chip group to mobile multi-select sheets.
- Added shared web `ThreadActivityIndicator` and replaced old needle-based card thread animation.
- Preserved payload fields and compatibility aliases.

## 14. Deferred Items

- Backend audience/age applicability metadata for categories, subcategories, and filter values.
- Full Product background publish tracker.
- Full StoreCollection background publish tracker.
- Shared cross-platform contract fixture for creator metadata labels and allowed enum values.

## 15. Risks

- Existing records can still contain inactive legacy category/filter values; edit flows must continue to tolerate them.
- Product/StoreCollection publishing can still feel less immediate than Design until they share a publish task layer.
- Mobile manual QA is still required on device for tag sheet scrolling and keyboard behavior.

## 16. Final Decision

R8 is acceptable as a scoped UX and reliability pass. Design creation is more compact and clear, seeded tags are more reliable, mobile tag state is more visible, and background publish behavior is documented with a low-risk Design placeholder improvement. No schema changes, migrations, DB resets, seeds, compatibility removals, or feed work were performed.

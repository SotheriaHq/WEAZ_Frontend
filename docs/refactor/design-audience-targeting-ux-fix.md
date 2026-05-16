# Design Audience Targeting UX Fix

## Summary

The `Who is it for?` field was not missing. Web and mobile already stored and submitted the audience value through the existing `type` / `audience` contract, but the web control was only inside the collapsed `Audience & visibility` section. Mobile showed audience as a visible row, while age group was still bundled into `Availability`.

## Backend Contract

- `type` / `audience`: `MALE`, `FEMALE`, `EVERYBODY`
- `targetAgeGroup`: `ADULT`, `CHILD`
- `fitPreference`: `SLIM`, `REGULAR`, `LOOSE`, `OVERSIZED`
- `sizingMode`: `NONE`, `RTW`, `CUSTOM`, `RTW_PLUS_FITTINGS`
- `visibility`: `PUBLIC`, `PRIVATE`

No backend schema, migration, payload rename, or compatibility removal was made.

## Web Changes

- Moved the visible `Who is it for?` selector into the Create Design metadata area near `What is it?` and `Garment type`.
- Added `Age group` beside the audience selector using the existing `targetAgeGroup` state.
- Kept a single source of state for each field.
- Renamed the collapsed lower section to `Sizing & visibility` because audience and age are no longer hidden there.
- Updated creator-facing labels:
  - `MALE` -> `Menswear`
  - `FEMALE` -> `Womenswear`
  - `EVERYBODY` -> `Unisex / Everybody`
  - `ADULT` -> `Adult`
  - `CHILD` -> `Kids`

## Mobile Changes

- Kept `Who is it for?` as a visible create-design row.
- Added a separate visible `Age group` row that opens its own selector.
- Removed age group from the `Availability` sheet to avoid duplicate controls.
- Preserved the payload fields sent to the backend.

## V1 Taxonomy Cleanup

Threadly V1 is clothing/garment-focused. These future-scope non-garment categories are intentionally excluded from active creator taxonomy options:

- shoes / footwear
- bags
- jewelry / jewellery
- accessories
- watches
- cosmetics / beauty / perfume

The backend default taxonomy no longer seeds `accessories`, `footwear`, `bags`, or `jewelry` as active V1 top-level garment categories. Those slugs are marked for seed deactivation to preserve foreign-key safety.

Web and mobile also filter those category options from creator category pickers so existing local dev data does not leak future-scope categories into V1 creation flows.

## Remaining Risks

- Existing database rows that already reference excluded categories are preserved for compatibility. They will not be offered as V1 creation options after the updated seed/deactivation flow runs.
- Historical reports may still mention the older broader taxonomy because they document earlier completed phases.
- Marketplace bag/cart wording is unrelated to garment taxonomy and was intentionally left untouched.

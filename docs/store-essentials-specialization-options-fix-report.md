# Store Essentials Specialization Options Fix

## Summary

Store Essentials now limits the brand focus question to the approved brand-positioning options and allows up to four selections.

## Files Changed

- `src/pages/store/StoreEssentials.tsx`

## Removed Options

- Luxury
- Accessories
- Footwear
- Bags
- Jewelry

## New Max Selection Count

- `MAX_SPECIALIZATIONS` changed from `3` to `4`.
- UI copy is derived from `MAX_SPECIALIZATIONS`, so it now renders:
  - `Select up to 4`
  - `Choose up to 4`
  - `0 of 4 selected`
  - `4 of 4 selected`

## Selection Behavior

- The user can select exactly four brand focus options.
- A fifth unselected option becomes disabled once four are selected.
- Clicking an already-selected option still deselects it.
- After deselecting, another option becomes selectable again.

## Prefill Behavior

- Existing saved tags are normalized through the active brand specialization option list.
- Saved tags matching removed options are ignored.
- Prefill keeps up to four valid values.

## Commands Run

- `npm run build` passed.
  - First attempt timed out at the 120s command limit while still building; rerun with a longer timeout passed.
- `npm run lint` passed with 56 existing warnings and 0 errors.
- `npm exec vitest -- run src/__tests__/storeSetup.test.ts src/__tests__/storeApi.test.ts` passed, 2 files / 3 tests.

## Scope Confirmation

- Backend was untouched.
- Mobile was untouched.
- Feed scoring, feed rendering, recommendation logic, interaction events, market/feed UI, and taxonomy refactors were untouched.

# Frontend Build-Green Cleanup Report

Date: 2026-05-15

## Summary

Fixed the unrelated TypeScript blockers that prevented `npm run build` from passing on frontend `main` after Phase 3 web creator taxonomy UI alignment was pushed as `b839320`.

This cleanup did not redo or revert Phase 3 taxonomy UI work.

## Files Changed

- `src/App.tsx`
- `src/pages/catalog/DesignDetailsPage.tsx`
- `src/utils/notificationRouting.ts`
- `docs/frontend-build-green-cleanup-report.md`

## Exact Build Errors Found

Initial `npm run build` failed during `tsc -b` with:

- `src/App.tsx(387,7)`: `DesignViewAliasRedirect` was declared but never used.
- `src/pages/catalog/DesignDetailsPage.tsx(68,44)`: `VLoader` was called with unsupported prop `label`.
- `src/utils/notificationRouting.ts(76,17)` and `(88,17)`: fallback switch branches compared a narrowed target type against `DESIGN`, which TypeScript correctly marked as impossible.

## Fixes Applied

- Removed unused `DesignViewAliasRedirect` from `src/App.tsx`.
  - `/designs/:id` already renders the canonical `DesignDetailsPage`.
  - Existing `/designs/create`, `/designs/:id/edit`, `/collections/create`, `/collections/:id/edit`, and `/collections/:id` routes were not changed.
- Updated `DesignDetailsPage` loading UI to match `VLoaderProps`.
  - Removed unsupported `label`.
  - Kept visible loading copy as a separate text element.
- Removed unreachable duplicate `DESIGN` comparisons from `notificationRouting.ts`.
  - `DESIGN` targets are still supported by the normalized notification target model.
  - `DESIGN` targets are routed before the fallback switch through `buildDesignRoute`.
  - `COLLECTION_MEDIA`, `COLLECTION`, `PRODUCT`, and `POST` fallback behavior was preserved.

## Commands Run

- `npm run build`
  - First run: failed with the three TypeScript blockers listed above.
  - Final run: passed. Vite completed production build.
- `npm run lint`
  - Passed with 56 warnings and 0 errors.
  - Warnings are existing app-wide hook/dependency and unused-variable warnings outside this focused cleanup.
- `npm test -- FilterSelector ProductApi --run`
  - Passed: 2 files / 4 tests.
  - Vitest still prints a jsdom `window.scrollTo` warning from animation internals after the passing run.

## Phase 3 Preservation

Phase 3 taxonomy UI alignment was not reverted. The creator metadata contract work remains in place, including the Phase 3 `FilterSelector`, creator metadata helper, product `gender` payload support, and creator-facing taxonomy labels.

## Scope Confirmation

- Backend was not changed.
- Mobile was not changed.
- Feed scoring was not implemented.
- Feed rendering was not changed.
- Recommendation logic was not implemented.
- Interaction events were not changed.
- Market/feed redesign work was not added.

## Known Follow-Up

Lint still reports existing warnings across unrelated files. They do not block the build, but they should be handled in a separate lint-cleanup pass if the team wants a warning-free frontend.

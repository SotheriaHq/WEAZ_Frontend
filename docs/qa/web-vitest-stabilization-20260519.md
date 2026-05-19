# Web Vitest Stabilization Backlog - 2026-05-19

## Context
During Phase 1 finalization, `npm run lint` passed and the Phase 1-specific DesignCard test gate was validated separately. The full command `npm run test -- --run` failed in broad unrelated suites.

## Not part of Phase 1
These failures are outside the Phase 1 safety/hygiene scope and must be handled as a dedicated stabilization task.

## Failing areas observed
- CustomOrderConfigurationEditor
- Dashboard analytics / finance
- Protected routes
- Payment return
- Order management missing RealtimeProvider
- useCollectionUpload unhandled rejections

## Required follow-up
1. Reproduce each failing suite independently.
2. Identify missing providers/mocks.
3. Fix tests without weakening production behavior.
4. Add a stable CI command split:
   - lint
   - focused changed-file tests
   - full test suite
5. Only after the full suite is stable should broad Vitest be restored as a mandatory merge gate.

## Phase 1 gate used
- threadly-mobile: `npm exec tsc -- --noEmit`
- fthreadly: `npm run lint`
- fthreadly: focused `DesignCard.test.tsx` Vitest run

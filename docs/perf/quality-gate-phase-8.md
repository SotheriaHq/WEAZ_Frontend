# Phase 8 Web Quality Gate

## Purpose

The web quality gate keeps the Phase 6 media/query protections and the focused runtime-hardening tests in CI and available as one local pre-push command.

## CI Workflow

Workflow: `.github/workflows/phase8-quality-gate.yml`

Triggers:

- `pull_request`
- `push` to `main`

CI uses Node `22.12.0`, `npm ci`, and the npm lockfile cache. It does not use secrets, browser auth fixtures, private-media fixture seeds, local databases, or destructive commands.

## Required Checks

Run locally with:

```bash
npm run ci:phase8
```

The grouped command runs:

- `npm run build`
- `npm run lint`
- `npm test -- --run src/__tests__/RequireStoreSetup.test.tsx src/__tests__/useBrandProfile.renderIsolation.test.tsx src/__tests__/renderableMedia.test.ts`
- `npm run check:perf-regressions`

## What It Protects

- Production build/type integration.
- ESLint guardrails.
- Store setup/provider test harness.
- Brand profile query render isolation.
- Renderable media policy tests.
- Phase 6 protections for deterministic query keys, query defaults, public-first media fallback, `retry: false` media fallback, signed URL call centralization, and force-refresh-only cache bypass.

## Manual Gates

Authenticated runtime tracing, private media fixture validation, and native AppState validation remain manual. This workflow does not run Playwright E2E or seeded local fixture commands.

## Rollback

To remove this gate, revert the workflow file and the `ci:phase8` script. Keep the individual media/query tests and performance guard unless a later phase replaces them with equivalent coverage.

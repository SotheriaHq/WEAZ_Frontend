# Studio cache retention

## Behaviour

Studio shares one TanStack Query client across route changes. Store profile and Policies share actor-and-brand-scoped general-settings reads; Policies also has its own scoped resource. Fresh resources are reused without another request. Stale resources stay visible while return to the screen revalidates them. Default freshness is three minutes and unused in-memory retention is thirty minutes. Display caches never grant authorization.

Verification loads status, draft and letter concurrently as one deduplicated actor/workspace-scoped resource. The existing owner-identity API route is unchanged. Contact settings and verification drafts are memory-only: the persistence allowlist excludes them. Logout/account cleanup removes their private query roots and cancels pending reads.

Cached forms hydrate before controls are shown. Pristine forms accept fresh server values, including cleared fields. Background reads preserve unsaved input and the selected verification step. A save clears the dirty marker only if no newer edit occurred. Verification previews match the current file key; changed evidence discards obsolete local object URLs. The phone control is reseeded by pristine server hydration, never on each keystroke.

Initial read failures show Retry instead of editable empty defaults. Multi-resource settings saves wait for all writes to settle before invalidating both reads, including partial failures. Relevant saves invalidate general settings, policy and setup-status caches. Verification saves/submission invalidate the wizard resource; late saves from an unmounted screen cannot replace the next account in Redux.

## Surfaces and existing native work

These screens serve desktop, tablet, mobile browsers and the native Studio WebView. Native already retains the Studio document and prewarms eligible recent brand users without navigating away from Catalogue. Native warm-entry, startup recovery and navigation contracts must stay green. This update changes no system bars, safe areas, permissions or store-setup authorization.

## Verification

Run npm run test:studio-cache and npm run test:studio-access, plus the web typecheck and lint. Coverage includes warm revisit, stale refresh, unsaved edits, identity/workspace changes, response-brand witness, retry, partial writes, phone hydration, changed-file previews, deleted evidence, cancellation, late account saves, disk exclusion and logout cleanup. CI runs the cache suite before release.

When the API returns, verify real profile/policy edits, evidence previews and route return on desktop, tablet, mobile browser and the signed Android app. Test stale returns, offline refresh, switching accounts and a cleared server draft. Input should stay visible and successful saves should require no manual refresh. Physical rendering timings and live API acceptance remain pending while the test backend is unavailable; local tests do not establish a production latency guarantee.

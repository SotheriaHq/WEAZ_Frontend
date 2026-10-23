# WIEZ Store and creator loading — 21 October 2026

The Store identity and actions use separate wrapping rows. Upgrade is a filled button rendered from server eligibility; embedded Studio lets native own the single CTA. Highest/legacy tiers do not offer a nonexistent upgrade. Store products start before status/verification finishes and share the panel's first 12-card query. Phone cards use the catalogue's 1:1.58 proportion.

Product and design forms share public category/filter query keys with five-minute freshness, request deduplication and cached rendering. Store warms these public options after its initial paint. Product categories no longer await private collections; nested garment types eliminate a redundant category-types request. The collection query remains account-scoped and cannot carry a prior account's data. Derived query data renders directly rather than being copied through extra state/effects. Style metadata failures are retryable and do not hide available cached options.

All category choices stay local after the taxonomy is loaded. Creator grids retain at least two columns. Existing drafts, standalone products, collection membership, permissions and publication requirements remain supported.

Customer lists use real paid standard/custom orders excluding cancellations/full refunds. Free brands see shoppers with at least one qualifying order; paid brands can configure a minimum, default three. Settings require the owner; customer reads require the existing order-read permission. Billing changes invalidate eligibility and customer criteria. Pagination and search retain distinct empty/loading/error states.

Verification: `npx tsc -b`; FilterSelector/component tests; `npx playwright test --config playwright.discovery.config.ts`. Browser tests cover widths 320/390/820/1440, embedded CTA/borders, first-card request sharing, customer criteria and a full product editor with private collections deliberately held pending while category selection remains usable. Synthetic fixtures are not production records.

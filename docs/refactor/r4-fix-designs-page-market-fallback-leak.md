# R4: Designs Page Market Fallback Leak

## Route Responsibility Audit

### Designs section

- Primary route: `/`
- Legacy design route alias: `/market`
- Sidebar item: `Designs`
- Rendering component: `Market` with `mode="designs"`

The `/market` route is kept as a design-feed alias because existing deep links and notification routes still use `/market?openDesign=...` to open design or media context. Redirecting it to the product market would break those links.

### Product / Market section

- Primary route: `/market-place`
- Sidebar item: `Market`
- Rendering component: `MarketPlace`

`MarketPlace` owns product browsing, seeded product rows, product cards, product prices, and bag/product actions.

### Product detail route

- Canonical route: `/products/:id`
- Route helper: `buildProductRoute`
- Rendering component: `ProductDetailsPage`

### Design detail route

- Canonical route: `/designs/:id`
- Route helper: `buildDesignRoute`
- Rendering component: `DesignDetailsPage`

Old collection aliases remain handled by `CollectionRouter`, which can open the design context from compatible legacy collection links.

## Root Cause

The `Designs` sidebar item pointed to `/`, and `/` rendered the `Market` page. That same `Market` page fetched the design feed from `marketApi.getFeed()`, but when the feed was empty and the selected category was `ALL`, it also fetched `/products/market` and rendered those rows as a fallback.

After a fresh reset and seed, the design feed can be empty while seeded products exist. That made the Designs section display product/market content:

- `READY-TO-WEAR`
- `Fresh products in market`
- product cards
- product prices
- bag actions

This was a page responsibility leak, not a seed issue.

## Route Decision

Root `/` remains the Designs section for compatibility with the current sidebar and default app entry. The legacy `/market` route also remains a design-feed alias because old notification and modal routes depend on it.

Product/market browsing remains on `/market-place`. The product fallback is now gated behind an explicit market context and is not allowed for the Designs context.

## Final Responsibility

- Designs feed route: `/`
- Legacy design feed alias: `/market`
- Designs page behavior: design cards or a design-specific empty state only
- Product/Market route: `/market-place`
- Product detail route: `/products/:id`
- Design detail route: `/designs/:id`

## Implementation Notes

- `Market` now accepts a mode:
  - `mode="designs"` for `/` and `/market`
  - `mode="market"` for any future explicit fallback market context
- Product fallback is controlled by `shouldLoadProductFallback`.
- The fallback only returns true when:
  - page mode is `market`
  - selected category is `ALL`
  - design item count is `0`
- The current product market page does not need the fallback because `MarketPlace` already loads product rows directly.

## Validation Checklist

- Designs/root route cannot render `Fresh products in market`.
- Designs/root route cannot render `Ready-to-wear`.
- Designs/root route cannot render product fallback cards.
- `/market-place` still renders product market content.
- Product detail route remains `/products/:id`.
- Design detail route remains `/designs/:id`.
- Legacy `/market?openDesign=...` compatibility is preserved.
- No DB reset was run.
- No seed was run.
- No backend schema was changed.
- Design mode was not enabled.
